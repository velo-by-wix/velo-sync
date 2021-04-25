import {Transform} from "./transform";
import {Config} from "../configurations/config";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import logger from "../util/logger";
import {ItemStatus, ItemWithStatus, saveItemBatch} from "../velo/velo-api";

export class TransformSave extends Transform<Array<ItemWithStatus>, Array<ItemWithStatus>> {
    private readonly config: Config;
    private readonly collection: string;
    private batchNum: number = 0;

    constructor(config: Config, collection: string, next: Next<Array<ItemWithStatus>>, concurrency: number, queueLimit: number, stats: Statistics) {
        super(next, concurrency, queueLimit, stats);
        this.config = config;
        this.collection = collection;
    }

    flush(): Promise<Array<ItemWithStatus>> {
        return Promise.resolve(undefined);
    }

    async process(item: Array<ItemWithStatus>): Promise<Array<ItemWithStatus>> {
        await this.saveItems(item.filter(_ => _.status !== ItemStatus.ok))
        return item;
    }

    async saveItems(batch: Array<ItemWithStatus>): Promise<void> {
        let thisBatchNum = this.batchNum++;
        logger.trace(`  saving batch ${thisBatchNum} with ${batch.length} items`)
        let ir = await saveItemBatch(this.config, this.collection, batch);
        logger.trace(`    saving batch ${thisBatchNum} with ${batch.length} items. inserted: ${ir.inserted}, updated: ${ir.updated}, skipped: ${ir.skipped}, errors: ${ir.errors}`)
        this.stats.reportProgress('update', batch.length);
    }

}