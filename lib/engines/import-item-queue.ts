import {Config} from "../config";
import Queue from 'promise-queue';
import {insertItemBatch} from "../velo/velo-api";
import logger from '../logger';
import {checkThrottling} from "../throttling";

export class ImportItemQueue {
    private readonly config: Config;
    private readonly collection: string;
    private concurrency: number;
    private queue: any;
    private onItemDoneHandler: (numberOfItems: number) => void;
    private currentBatch: Array<any> = [];
    private readonly batchSize: number;
    private completedCount: number = 0;
    private batchNum: number = 0;
    constructor(config: Config, collection: string, concurrency: number, batchSize: number) {
        this.config = config;
        this.collection = collection;
        this.concurrency = concurrency;
        this.batchSize = batchSize;

        this.queue = new Queue(concurrency, Infinity);
    }

    async importItem(item) {
        this.currentBatch.push(item);
        if (this.currentBatch.length >= this.batchSize)
            return this.flush();
        else
            return Promise.resolve();
    }

    async doInsert(batchToInsert: Array<any>) {
        let thisBatchNum = this.batchNum++;
        let batchSize = batchToInsert.length;
        await checkThrottling(1);
        logger.trace(`  importing batch ${thisBatchNum} of ${batchSize} items`)
        let insertResult = await insertItemBatch(this.config, this.collection, batchToInsert);
        logger.trace(`    imported batch ${thisBatchNum} of ${batchSize} items. `)
        logger.dump(insertResult);
        this.triggerItemDone(batchSize);
        return insertResult;
    }

    private triggerItemDone(numberOfItems: number) {
        this.completedCount += numberOfItems;
        this.onItemDoneHandler(numberOfItems)
    }

    async flush() {
        let insertPromise = this.doInsert(this.currentBatch);
        this.currentBatch = [];
        return insertPromise;
    }

    onItemDone(handler: (numberOfItems: number) => void) {
        this.onItemDoneHandler = handler;
    }
}