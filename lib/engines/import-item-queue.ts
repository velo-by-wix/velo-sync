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
    private queuedCount: number = 0;
    private completedCount: number = 0;
    private batchNum: number = 0;
    private resolveCompleted: Array<(v: any) => void> = [];
    constructor(config: Config, collection: string, concurrency: number, batchSize: number) {
        this.config = config;
        this.collection = collection;
        this.concurrency = concurrency;
        this.batchSize = batchSize;

        this.queue = new Queue(concurrency, Infinity);
    }

    importItem(item): void {
        this.currentBatch.push(item);
        if (this.currentBatch.length >= this.batchSize)
            this.flush();
    }

    async doInsert(batchToInsert: Array<any>) {
        this.queue.add(async () => {
            let thisBatchNum = this.batchNum++;
            let batchSize = batchToInsert.length;
            this.queuedCount += batchSize;
            await checkThrottling(1);
            logger.trace(`  importing batch ${thisBatchNum} with ${batchSize} items`)
            let ir = await insertItemBatch(this.config, this.collection, batchToInsert);
            logger.trace(`    imported batch ${thisBatchNum} with ${batchSize} items. inserted: ${ir.inserted}, updated: ${ir.updated}, skipped: ${ir.skipped}, errors: ${ir.errors}`)
            this.triggerDone(batchSize);
            return ir;
        })
    }

    private triggerDone(numberOfItems: number) {
        this.completedCount += numberOfItems;
        this.onItemDoneHandler(numberOfItems)
        if (this.completedCount === this.queuedCount) {
            this.resolveCompleted.forEach(_ => _('done'));
            this.resolveCompleted = [];
        }
    }

    flush(): void {
        this.doInsert(this.currentBatch);
        this.currentBatch = [];
    }

    complete() {
        return new Promise(resolve => {
            this.resolveCompleted.push(resolve);
        })
    }

    onItemDone(handler: (numberOfItems: number) => void) {
        this.onItemDoneHandler = handler;
    }
}