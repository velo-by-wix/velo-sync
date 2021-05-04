import {Transform} from "./transform";
import {Config} from "../configurations/config";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import logger from "../util/logger";
import {getUploadUrl, ItemStatus, ItemWithStatus, uploadFile} from "../velo/velo-api";
import {Schema} from "../configurations/schema";
import {URL} from 'url';
import {promises as fs} from 'fs';
import probe from 'probe-image-size';
import axios from "axios";
import path from 'path';
import {camelCase} from 'change-case';
import * as crypto from 'crypto';
import {forEach} from "../util/async-foreach";
import {Failure, Success, TryOp, tryProcessItem} from "../util/try";
import {RejectsReporter} from "../util/rejects-reporter";


interface ProbeImageSizeResult {
    width: number,
    height: number,
    type: string,
    mime: string,
    wUnits: string,
    hUnits: string,
    url: string
}

type UploadResult = {newValue: any, uploadedImages: number}

/**
 * is it a url of the form
 * wix:image://v1/11062b_049e75ff426d48d1a794debb05897c8c~mv2_d_4505_3003_s_4_2.jpg/Girl%20with%20Leather%20Backpack.jpg#originWidth=4505&originHeight=3003
 * @param fileUrl
 */
function isVeloUrl(fileUrl: string): boolean {
    let [scheme, ...rest] = fileUrl.split('//');
    return ['wix:image:', 'wix:video:'].includes(scheme);
}

/**
 * is it a url of the form
 * https://static.wixstatic.com/media/11062b_049e75ff426d48d1a794debb05897c8c~mv2_d_4505_3003_s_4_2.jpg/v1/fill/w_144,h_96,al_c,q_80,usm_0.66_1.00_0.01/Girl%20with%20Leather%20Backpack.webp
 * @param fileUrl
 */
function isStoredOnWixStatics(fileUrl: string) {
    return fileUrl.indexOf('https://static.wixstatic.com/media') === 0;
}

function formatWixImageUrl(fileId: string, fileName: string, width: number, height: number) {
    return `wix:image://v1/${fileId}/${fileName}#originWidth=${width}&originHeight=${height}`
}

const parseStaticUrl = /https:\/\/static\.wixstatic\.com\/media\/([\w~_.]*)\/.*\/([\w%]*\.\w+)/;
async function toVeloUrl(staticUrl: string) {
    let parsedUrl = parseStaticUrl.exec(staticUrl);
    if (parsedUrl) {
        let imageId = parsedUrl[1];
        let imageName = parsedUrl[2];
        let fileStats = (await probe(staticUrl)) as ProbeImageSizeResult;
        return formatWixImageUrl(imageId, imageName, fileStats.width, fileStats.height);
    }
    return staticUrl;
}

export interface FileUploadCache {
    setVeloFileUrl(fileUrlOrPath: string, hash: string, veloFileUrl: string): Promise<void>;
    getVeloFileUrl(fileUrlOrPath: string, hash: string): Promise<string>;
}

export class NoopFileUploadCache implements FileUploadCache {
    getVeloFileUrl(fileUrlOrPath: string, hash: string): Promise<string> {
        return Promise.resolve(undefined);
    }

    setVeloFileUrl(fileUrlOrPath: string, hash: string, veloFileUrl: string): Promise<void> {
        return Promise.resolve(undefined);
    }
}

const isFileProtocol = /file:/i;
const isHttpProtocol = /http(s)?:/i;
interface ParseUrlResult {
    filePath?: string,
    isFile?: boolean,
    isHttp?: boolean,
    fileName?: string
}
function parseUrl(fileUrlOrPath: string): ParseUrlResult {
    try {
        let url = new URL(fileUrlOrPath);
        if (url.protocol.match(isFileProtocol))
            return {isFile: true, filePath: url.pathname, fileName: path.basename(url.pathname)}
        else if (url.protocol.match(isHttpProtocol))
            return {isHttp: true, fileName: path.basename(url.pathname)}
    }
    catch (e) {
        return {isFile: true, filePath: fileUrlOrPath, fileName: path.basename(fileUrlOrPath)}
    }
}

export class TransformImportFiles extends Transform<Array<ItemWithStatus>, Array<ItemWithStatus>> {
    private readonly config: Config;
    private readonly schema: Schema;
    private readonly collection: string;
    private readonly importFileFolder: string;
    private batchNum: number = 0;
    private readonly fileUploadCache: FileUploadCache;
    private readonly rejectsReporter: RejectsReporter;
    constructor(config: Config, schema: Schema, importFileFolder: string, collection: string, next: Next<Array<ItemWithStatus>>,
                fileUploadCache: FileUploadCache,
                concurrency: number, queueLimit: number, stats: Statistics, rejectsReporter: RejectsReporter) {
        super(next, concurrency, queueLimit, stats);
        this.config = config;
        this.schema = schema;
        this.collection = collection;
        this.importFileFolder = importFileFolder;
        this.fileUploadCache = fileUploadCache;
        this.rejectsReporter = rejectsReporter;
    }

    flush(): Promise<Array<ItemWithStatus>> {
        return Promise.resolve(undefined);
    }

    async process(batch: Array<ItemWithStatus>): Promise<Array<ItemWithStatus>> {
        let itemsProcessed = await this.uploadFiles(batch.filter(_ => _.status !== ItemStatus.ok ))
        return itemsProcessed;
    }
                  
    async uploadFiles(batch: Array<ItemWithStatus>): Promise<Array<ItemWithStatus>> {
        let thisBatchNum = this.batchNum++;
        logger.log(`  upload images for batch ${thisBatchNum} with ${batch.length} items needing image upload`)

        let uploadStats = {uploads: 0};
        let uploadedItems: Array<TryOp<ItemWithStatus, ItemWithStatus>> = await forEach(batch, item => {
            return tryProcessItem(item, item => {
                return this.uploadFilesForItem(item, uploadStats)
            })
        })

        let successfullyLoadedItems = uploadedItems
            .filter(_ => _.isOk())
            .map(_ => (_ as Success<ItemWithStatus>).item);

        let rejectedItems: Array<Failure<ItemWithStatus>> = uploadedItems
            .filter(_ => !_.isOk())
            .map(_ => _ as Failure<ItemWithStatus>)

        rejectedItems.forEach(failure => this.rejectsReporter.reject(failure.item, failure.error))

        logger.trace(`    uploaded images for batch ${thisBatchNum} with ${successfullyLoadedItems.length} items. Uploaded Images: ${uploadStats.uploads}, rejected: ${rejectedItems.length}`)
        this.stats.reportProgress('items with uploaded items', successfullyLoadedItems.length);
        return successfullyLoadedItems;
    }

    private async uploadFilesForItem(item: ItemWithStatus, uploadStats: {uploads: number}) {
        for (let key of Object.keys(this.schema.fields)) {
            let fieldType = this.schema.fields[key];
            let newValue, uploadedImages;
            if (['Image', 'Gallery', 'Document', 'Video', 'Audio'].find(ft => ft === fieldType) !== undefined) {
                if (fieldType === 'Image')
                    ({newValue, uploadedImages} = await this.importImage(item.item[camelCase(key)], item.item._id, key))
                else if (fieldType === 'Video' || fieldType === 'Document' || fieldType === 'Audio')
                    ({
                        newValue,
                        uploadedImages
                    } = await this.importFile(fieldType.toLowerCase(), item.item[key], item.item._id, key))
                else if (fieldType === 'Gallery')
                    ({newValue, uploadedImages} = await this.importGallery(item.item[key], item.item._id, key))
                item.item[camelCase(key)] = newValue;
                uploadStats.uploads += uploadedImages;
            }
        }
        return item;
    }

    private async importImage(imageUrl: string, _id: string, fieldName: string): Promise<UploadResult> {
        let shouldUpload = await this.checkNeedUpload(imageUrl);
        if (!shouldUpload.shouldUpload)
            return {newValue: shouldUpload.veloUrl, uploadedImages: 0};

        let {parsedUrl, fileContent} = await this.getFileContent(imageUrl);
        let mimeType = ((await probe.sync(fileContent)) as ProbeImageSizeResult).mime;
        let uploadResult = await this.uploadFile(imageUrl, 'image', mimeType, _id, fieldName, fileContent, parsedUrl.fileName);

        this.stats.reportProgress('upload images', uploadResult.uploadedImages);
        return uploadResult
    }

    private async importFile(mediaType: string, videoUrl: string, _id: string, fieldName: string): Promise<UploadResult> {
        let shouldUpload = await this.checkNeedUpload(videoUrl);
        if (!shouldUpload.shouldUpload)
            return {newValue: shouldUpload.veloUrl, uploadedImages: 0};

        let {parsedUrl, fileContent} = await this.getFileContent(videoUrl);
        let uploadResult = await this.uploadFile(videoUrl, mediaType, undefined, _id, fieldName, fileContent, parsedUrl.fileName);

        this.stats.reportProgress('upload ' + mediaType, uploadResult.uploadedImages);
        return uploadResult
    }

    private async importGallery(gallery: any, _id: string, fieldName: string): Promise<UploadResult> {
        let galleryUploadedImages = 0;
        if (Array.isArray(gallery)) {
            for (let galleryItem of gallery) {
                if (galleryItem.type === 'image') {
                    let {newValue, uploadedImages} = await this.importImage(galleryItem.src, _id, fieldName);
                    galleryItem.src = newValue;
                    galleryUploadedImages += uploadedImages;
                }
                else if (galleryItem.type === 'video') {
                    let {newValue, uploadedImages} = await this.importFile('video', galleryItem.src, _id, fieldName);
                    galleryItem.src = newValue;
                    galleryUploadedImages += uploadedImages;
                }
            }
        }
        return {newValue: gallery, uploadedImages: galleryUploadedImages};
    }

    private async uploadFile(fileUrlOrPath: string, mediaType: string, mimeType: string, _id: string, fieldName: string, fileContent: Buffer, fileName: string): Promise<UploadResult> {
        let hash = md5(fileContent);
        let veloFileUrl = await this.fileUploadCache.getVeloFileUrl(fileUrlOrPath, hash);
        let uploadedImages = 0;
        if (!veloFileUrl) {
            logger.trace(`    uploading file ${fileUrlOrPath}`)
            let uploadUrl = await getUploadUrl(this.config, mediaType, mimeType, _id, this.collection, fieldName)
            veloFileUrl = await uploadFile(uploadUrl, fileContent, fileName, mediaType, mimeType);
            await this.fileUploadCache.setVeloFileUrl(fileUrlOrPath, hash, veloFileUrl);
            uploadedImages = 1;
        }
        return {newValue: veloFileUrl, uploadedImages};
    }

    private async getFileContent(fileUrlOrPath: string) {
        let parsedUrl = parseUrl(fileUrlOrPath);
        let fileContent;
        if (parsedUrl.isHttp)
            fileContent = await getFileContentFromHttp(fileUrlOrPath);
        else if (parsedUrl.isFile)
            fileContent = await this.getFileContentFromFile(parsedUrl.filePath);
        return {parsedUrl, fileContent};
    }

    private async checkNeedUpload(fileUrl: string): Promise<{shouldUpload: boolean, veloUrl?: string}> {
        if (fileUrl === "")
            return {shouldUpload: false, veloUrl: undefined};
        if (isVeloUrl(fileUrl))
            return {shouldUpload: false, veloUrl: fileUrl};
        else if (isStoredOnWixStatics(fileUrl)) {
            let veloUrl = await toVeloUrl(fileUrl)
            return {shouldUpload: false, veloUrl};
        }
        else
            return {shouldUpload: true}
    }

    private async getFileContentFromFile(filePath: string) {
        let fullPath = path.resolve(this.importFileFolder, filePath)
        return await fs.readFile(fullPath);
    }
}


async function getFileContentFromHttp(url: string) {
    let imageResponse = await axios.get(url.toString(), {responseType: 'arraybuffer'});
    return Buffer.from(imageResponse.data, 'binary')
}

function md5(data: Buffer) {
    return crypto.createHash('md5').update(data).digest('hex');
}
