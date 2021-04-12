import {Config} from "./config";
import Queue from 'promise-queue';
import {insertItemBatch} from "./velo-api";
import logger from './logger';

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

    async doInsert() {
        let thisBatchNum = this.batchNum++;
        let batchSize = this.currentBatch.length;
        logger.trace(`  importing batch ${thisBatchNum} of ${batchSize} items`)
        let insertResult = await insertItemBatch(this.config, this.collection, this.currentBatch);
        logger.trace(`    imported batch ${thisBatchNum} of ${batchSize} items. `)
        this.triggerItemDone(batchSize);
        return insertResult;
    }

    private triggerItemDone(numberOfItems: number) {
        this.completedCount += numberOfItems;
        this.onItemDoneHandler(numberOfItems)
    }

    async flush() {
        let insertPromise = this.doInsert();
        this.currentBatch = [];
        return insertPromise;
    }

    onItemDone(handler: (numberOfItems: number) => void) {
        this.onItemDoneHandler = handler;
    }
}