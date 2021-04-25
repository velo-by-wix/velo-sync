import {forbidden, ok, serverError} from 'wix-http-functions';
import wixData from 'wix-data';
import crypto from 'crypto';
import PromiseQueue from 'promise-queue';
import wixSecretsBackend from 'wix-secrets-backend';

// URL to call this HTTP function from your published site looks like:
// Premium site - https://mysite.com/_functions/example/multiply?leftOperand=3&rightOperand=4
// Free site - https://username.wixsite.com/mysite/_functions/example/multiply?leftOperand=3&rightOperand=4

// URL to test this HTTP function from your saved site looks like:
// Premium site - https://mysite.com/_functions-dev/example/multiply?leftOperand=3&rightOperand=4
// Free site - https://username.wixsite.com/mysite/_functions-dev/example/multiply?leftOperand=3&rightOperand=4

const FORBIDDEN = 'forbidden';

function Queue(concurrency, tasks) {
  return new Promise(function(resolve, reject) {
    let q = new PromiseQueue(concurrency, Infinity, {onEmpty: function() {
        if (q.getPendingLength() === 0)
          resolve();
      }});

    if (tasks.length > 0)
      tasks.forEach(_ => q.add(_));
    else
      resolve();
  })
}

async function validateAndParseRequest(request) {
  const payload = await request.body.text();
  const payloadJson = JSON.parse(payload, dateReviver);
  const secret = await wixSecretsBackend.getSecret("velo-sync")
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payloadJson.data, dateReplacer));
  const digest = hmac.digest('hex');
  if (digest !== payloadJson.signature) {
    let forbiddenError = new Error('invalid signature check')
    forbiddenError.type = FORBIDDEN;
    throw forbiddenError;
  }
  return payloadJson.data;
}

async function logRequest(name, handler) {
  console.log(name, 'start');
  let start = new Date().getTime();
  try {
    let response = await handler();
    let now = new Date().getTime();
    console.log(name, 'completed ok, time:', now - start)
    return ok({body: response});
  }
  catch (e) {
    let now = new Date().getTime();
    if (e.type === FORBIDDEN) {
      console.log(name, 'forbidden:', e.message, ', time:', now - start)
      return forbidden({body: e.message});
    }
    else {
      console.log(name, 'failed with error:', e.message, ', time:', now - start)
      return serverError({body: e.message})
    }
  }
}

export async function post_isAlive(request) {
  return await logRequest('isAlive', async () => {
    let data = await validateAndParseRequest(request)
    if (data.isAlive === '?')
      return 'ok';
    else
      throw new Error('protocol error - the isAlive API expects isAlive member in the data payload');
  })
}

export async function post_insertItemBatch(request) {
  return await logRequest('insertItemBatch', async () => {
    let data = await validateAndParseRequest(request)
    let itemsToInsert = data.items;
    let collection = data.collection;
    return await wixData.bulkInsert(collection, itemsToInsert, {suppressAuth: true});
  })
}

export async function post_saveItemBatch(request) {
  return await logRequest('saveItemBatch', async () => {
    let data = await validateAndParseRequest(request)
    let items = data.items;
    let collection = data.collection;
    return await wixData.bulkSave(collection, items, {suppressAuth: true});
  })
}

export async function post_clearStale(request) {
  return await logRequest('clearStale', async () => {
    let data = await validateAndParseRequest(request)
    let collection = data.collection;

    let date = new Date();
    date.setDate(date.getDate() - 3);

    let res = await wixData.query(collection)
      .lt('_updatedDate', date)
      .find({suppressAuth: true});
    console.log(`clearStale - found ${res.totalCount} items to remove, current page ${res.length}`);
    let itemsToDelete = res.items;
    let ids = itemsToDelete.map(_ => _._id);
    let removeResult = await wixData.bulkRemove(collection, ids, {suppressAuth: true});

    return {itemsRemoved: removeResult.removed, staleItems: res.totalCount - removeResult.removed, errors: removeResult.errors};
  })
}

export async function post_batchCheckUpdateState(request) {
  return await logRequest('isAlive', async () => {
    let data = await validateAndParseRequest(request)

    const collection = data.collection;
    const items = data.items;

    let queries = items.map(item => wixData.query(collection).eq('_id', item._id));

    let query = queries.reduce((accuQuery, query) => (!!accuQuery)?accuQuery.or(query): query);
    let result = [];
    let itemsToUpdate = [];
    let res = await query.find({suppressAuth: true});
    items.forEach(item => {
      let foundItem = res.items.find(_ => _._id === item._id);
      if (foundItem && foundItem._hash === item._hash) {
        itemsToUpdate.push(foundItem);
        result.push({status: 'ok', _id: item._id});
      }
      else if (foundItem) {
        result.push({status: 'need-update', _id: item._id});
      }
      else {
        result.push({status: 'not-found', _id: item._id});
      }
    });
    await wixData.bulkUpdate(collection, itemsToUpdate, {suppressAuth: true});
    return JSON.stringify(result);
  })
}

export async function post_getImageUploadUrl(request) {
  return await logRequest('isAlive', async () => {
    let data = await validateAndParseRequest(request)

    const mimeType = data.mimeTypes;
    const _id = data._id;
    const fieldName = data.fieldName;
    const collection = data.collection;
    const mediaType = data.mediaType;

    let uploadUrlObj = await mediaManager.getUploadUrl('/synced-images',
      {
        "mediaOptions": {
          mimeType,
          mediaType
        },
        "metadataOptions": {
          "isPrivate": false,
          "isVisitorUpload": false,
          "context": {
            _id,
            fieldName,
            collection
          }
        }
      });
    return uploadUrlObj;
  });
}

const dateRegex = /^Date\((\d+)\)$/;
function dateReviver(key, value) {
  const match = dateRegex.exec(value);
  if (match) {
    return new Date(Number(match[1]));
  }
  return value;
}

function dateReplacer(key, value) {
  let v = this[key];
  if (v instanceof Date)
    return 'Date('+v.getTime()+')';
  else
    return value
}