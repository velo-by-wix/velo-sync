import {Config} from "../configurations/config";
import invokeApi from "./invoke-velo-api";
import {HasHashAndId} from "../etl/transform-normalize-fields";
import * as request from 'request-promise';

export interface WixDataBulkResult {
    inserted: number,               // The number of inserted items.
    updated: number,                // The number of updated items.
    skipped: number,                // The number of skipped items.
    insertedItemIds: Array<string>, // List of IDs of inserted items.
    errors: Array<Error>,           // List of errors.
    updatedItemIds: Array<string>   // List of IDs of updated items.
}

export interface RemoveStaleResult {
    itemsRemoved: number,
    staleItems: number,
    errors: number
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

export async function saveItemBatch(config: Config, collection: string, items: Array<any>): Promise<WixDataBulkResult> {
    return await invokeApi(config, 'saveItemBatch', {
        items, collection
    });
}

export async function removeStaleItems(config: Config, collection: string): Promise<RemoveStaleResult> {
    return await invokeApi(config, 'clearStale', {
        collection
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

export interface UploadUrl {
    uploadUrl: string,
    uploadToken: string
}
export async function getUploadUrl(config: Config, mediaType: string, mimeType: string, _id: string, collection: string, fieldName: string): Promise<UploadUrl> {
    return await invokeApi(config, 'getImageUploadUrl', {
        mimeType,
        _id,
        collection,
        fieldName,
        mediaType
    })
}

export async function uploadFile(uploadUrl: UploadUrl, contentStream: Buffer, fileName: string, contentType: string) {
    const body = {
        upload_token: uploadUrl.uploadToken,
        file: {
            value: contentStream,
            options: {
                filename: fileName,
                contentType: contentType
            }
        }
    };

    const response = await request.post({url: uploadUrl, formData: body, json: true});
    return `wix:image://v1/${response[0].file_name}/${response[0].original_file_name}#originWidth=${response[0].width}&originHeight=${response[0].height}`;
}