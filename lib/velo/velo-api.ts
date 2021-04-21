import {Config} from "../configurations/config";
import invokeApi from "./invoke-velo-api";
import {HasHashAndId} from "../etl/transform-normalize-fields";

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

export async function insertItemBatch(config: Config, collection: string, items: Array<any>): Promise<WixDataBulkResult> {
    return await invokeApi(config, 'insertItemBatch', {
        items, collection
    });
}

export enum ItemStatus {
    ok, needUpdate, notFound
}

export interface ItemWithStatus {
    item: HasHashAndId
    status: ItemStatus
}

export interface ApiItemStatusResult {
    _id: string
    status: ItemStatus
}

export async function checkUpdateState(config: Config, collection: string, items: Array<HasHashAndId>): Promise<Array<ItemWithStatus>> {
    let itemsToSend = items.map(_ => {
        let {_id, _hash} = _
        return {_id, _hash};
    })
    let apiResult = await invokeApi(config, 'batchCheckUpdateState', {
        itemsToSend, collection
    }) as Array<ApiItemStatusResult>;

    return apiResult.map(itemStatus => {
        let item = items.find(_ => _._id = itemStatus._id)
        return {status: itemStatus.status, item}
    })
}