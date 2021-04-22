import {Transform} from "./transform";
import {Config} from "../configurations/config";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import logger from "../util/logger";
import {getUploadUrl, ItemStatus, ItemWithStatus, uploadFile} from "../velo/velo-api";
import {Schema} from "../configurations/schema";
import {URL} from 'url';
import fs from 'fs/promises';
import probe from 'probe-image-size';
import axios from "axios";

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
    return ['wix:image', 'wix:video'].includes(scheme);
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

export class TransformImportFiles extends Transform<Array<ItemWithStatus>, Array<ItemWithStatus>> {
    private readonly config: Config;
    private readonly schema: Schema;
    private readonly collection: string;
    private batchNum: number = 0;
    constructor(config: Config, schema: Schema, collection: string, next: Next<Array<ItemWithStatus>>, concurrency: number, queueLimit: number, stats: Statistics) {
        super(next, concurrency, queueLimit, stats);
        this.config = config;
        this.schema = schema;
        this.collection = collection;
    }

    flush(): Promise<Array<ItemWithStatus>> {
        return Promise.resolve(undefined);
    }

    async process(item: Array<ItemWithStatus>): Promise<Array<ItemWithStatus>> {
        await this.uploadFiles(item.filter(_ => _.status !== ItemStatus.ok ))
        return item;
    }

    async uploadFiles(batch: Array<ItemWithStatus>): Promise<void> {
        let thisBatchNum = this.batchNum++;
        logger.trace(`  upload images for batch ${thisBatchNum} with ${batch.length} items needing image upload`)

        let totalUploadedImages = 0;
        for (let item of batch) {
            for (let key of Object.keys(this.schema.fields)) {
                let fieldType = this.schema.fields[key];
                let newValue, uploadedImages;
                if (fieldType === 'Image')
                    ({newValue, uploadedImages} = await this.importImage(item[key], item.item._id, key))
                else if (fieldType === 'Document')
                    ({newValue, uploadedImages} = await this.importDocument(item[key], item.item._id, key))
                else if (fieldType === 'Video')
                    ({newValue, uploadedImages} = await this.importVideo(item[key], item.item._id, key))
                else if (fieldType === 'Audio')
                    ({newValue, uploadedImages} = await this.importAudio(item[key], item.item._id, key))
                else if (fieldType === 'Gallery')
                    ({newValue, uploadedImages} = await this.importGallery(item[key], item.item._id, key))
                item[key] = newValue;
                totalUploadedImages += uploadedImages;
            }
        }

        logger.trace(`    upload images for batch ${thisBatchNum} with ${batch.length} items needing image upload. Uploaded Images: ${totalUploadedImages}`)
        this.stats.reportProgress('check update state', batch.length);
    }

    async importImage(imageUrl: string, _id: string, fieldName: string): Promise<UploadResult> {
        let shouldUpload = await this.checkNeedUpload(imageUrl);
        if (!shouldUpload.shouldUpload)
            return {newValue: shouldUpload.veloUrl, uploadedImages: 0};

        let url = new URL(imageUrl);
        let fileContent = await getFileContentFromUrl(url);

        let mimeType = ((await probe(imageUrl)) as ProbeImageSizeResult).mime;
        let uploadUrl = await getUploadUrl(this.config, 'image', mimeType, _id, this.collection, fieldName)
        let uploadedImageUrl = await uploadFile(uploadUrl, fileContent, url.pathname, mimeType);
        return {newValue: uploadedImageUrl, uploadedImages: 1}
    }

    async importDocument(documentUrl: string, _id: string, fieldName: string): Promise<UploadResult> {

    }

    async importVideo(videoUrl: string, _id: string, fieldName: string): Promise<UploadResult> {

    }

    async importAudio(audioUrl: string, _id: string, fieldName: string): Promise<UploadResult> {

    }

    async importGallery(galleryUrl: string, _id: string, fieldName: string): Promise<UploadResult> {

    }

    async checkNeedUpload(fileUrl: string): Promise<{shouldUpload: boolean, veloUrl?: string}> {
        if (isVeloUrl(fileUrl))
            return {shouldUpload: false, veloUrl: fileUrl};
        else if (isStoredOnWixStatics(fileUrl)) {
            let veloUrl = await toVeloUrl(fileUrl)
            return {shouldUpload: false, veloUrl};
        }
        else
            return {shouldUpload: true}
    }
}

async function getFileContentFromUrl(url: URL) {
    if (url.protocol === 'file:') {
        return await fs.readFile(url);
    }
    else {
        let imageResponse = await axios.get(url.toString(), {responseType: 'arraybuffer'});
        return Buffer.from(imageResponse.data, 'binary')
    }
}