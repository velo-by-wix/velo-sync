import {Config} from "./config";
import invokeApi from "./invoke-velo-api";

export interface WixDataBulkResult {
    inserted: number,               // The number of inserted items.
    updated: number,                // The number of updated items.
    skipped: number,                // The number of skipped items.
    insertedItemIds: Array<string>, // List of IDs of inserted items.
    errors: Array<Error>,           // List of errors.
    updatedItemIds: Array<string>   // List of IDs of updated items.
}

export async function isAlive(config: Config) {
    let res = await invokeApi(config, 'isAlive', {isAlive: '?'});
    if (res !== 'ok')
        throw new Error(`failed to call isAlive API - got response ${res} but expecting 'ok'`);
}

// export async function getSchema(config: Config) {
//     let res = await invokeApi(config, 'getSchema', {collection: 'items'});
//     console.log(res);
// }

export async function insertItemBatch(config: Config, collection: string, items: Array<any>): Promise<WixDataBulkResult> {
    return await invokeApi(config, 'insertItemBatch', {
        items, collection
    });
}