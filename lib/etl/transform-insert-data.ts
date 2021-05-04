import {Transform} from "./transform";
import {Config} from "../configurations/config";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import logger from "../util/logger";
import {insertItemBatch} from "../velo/velo-api";


export class InsertData extends Transform<Array<any>, any> {
    private readonly config: Config;
    private readonly collection: string;
    private batchNum: number = 0;
    constructor(config: Config, collection: string, next: Next<any>, concurrency: number, queueLimit: number, stats: Statistics) {
        super(next, concurrency, queueLimit, stats);
        this.config = config;
        this.collection = collection;
    }

    flush(): Promise<any | undefined> {
        return Promise.resolve(undefined);
    }

    process(item: Array<any>): Promise<any | undefined> {
        return this.insertBatch(item);
    }

    async insertBatch(batch: Array<any>): Promise<any> {
        let thisBatchNum = this.batchNum++;
        logger.log(`  importing batch ${thisBatchNum} with ${batch.length} items`)
        let ir = await insertItemBatch(this.config, this.collection, batch);
        logger.trace(`    imported batch ${thisBatchNum} with ${batch.length} items. inserted: ${ir.inserted}, updated: ${ir.updated}, skipped: ${ir.skipped}, errors: ${ir.errors}`)
        this.stats.reportProgress('insert', batch.length);
    }


}