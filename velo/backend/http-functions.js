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

// export async function post_saveItemBatch(request) {
//   console.log('saveItemBatch start');
//   const payload = await request.body.text();
//   const payloadJson = JSON.parse(payload, dateReviver);
//   const collection = payloadJson.collection;
//   const items = payloadJson.data;
//
//   const hmac = crypto.createHmac('sha256', secret);
//   hmac.update(JSON.stringify(items, dateReplacer) + collection);
//   if (hmac.digest('hex') !== payloadJson.signature) {
//     return forbidden({body: 'invalid signature'});
//   }
//
//   try {
//     let bulkResult = await wixData.bulkSave(collection, items, {suppressAuth: true});
//     console.log('saveItemBatch bulkUpdate', bulkResult);
//   }
//   catch (e) {
//     return ok({body: e.stack});
//   }
//   console.log('saveItemBatch completed');
//   return ok({body: 'ok'});
// }
//
// export async function post_clearStale(request) {
//   console.log('clearStale start');
//   const payload = await request.body.text();
//   const payloadJson = JSON.parse(payload, dateReviver);
//   const collection = payloadJson.collection;
//
//   const hmac = crypto.createHmac('sha256', secret);
//   hmac.update(collection);
//   if (hmac.digest('hex') !== payloadJson.signature) {
//     return forbidden({body: 'invalid signature'});
//   }
//
//   try {
//     let date = new Date();
//     date.setDate(date.getDate() - 3);
//
//     console.log('clearStale - query clear stale for', collection);
//     let res = await wixData.query(collection)
//       .lt('_updatedDate', date)
//       .find({suppressAuth: true});
//     console.log(`clearStale - found ${res.totalCount} items to remove, current page ${res.length}`);
//     let itemsToDelete = res.items;
//     let removed = 0;
//     let errors = 0;
//     let tasks = [];
//     for (let i=0; i < itemsToDelete.length; i++) {
//       tasks.push(async function() {
//         try {
//           await wixData.remove(collection, itemsToDelete[i]._id, {suppressAuth: true});
//           removed++
//         }
//         catch (e) {
//           console.log(`clearStale - delete item - error`, e.stack);
//           errors++
//         }
//       });
//     }
//     await Queue(10, tasks);
//
//     return ok({body: {itemsRemoved: removed, staleItems: res.totalCount - removed, errors: errors}});
//   }
//   catch (e) {
//     console.log(`clearStale - error`, e.stack);
//     return ok({body: e.stack});
//   }
// }
//
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