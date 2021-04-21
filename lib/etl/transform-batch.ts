import {Transform} from "./transform";
import {Next} from "./source";
import {Statistics} from "../util/statistics";


export class TransformBatch<T> extends Transform<T, Array<T>> {
    private currentBatch: Array<T> = [];
    private batchSize: number;

    constructor(next: Next<Array<T>>, queueLimit: number, stats: Statistics, batchSize: number) {
        super(next, 1, queueLimit, stats);
        this.batchSize = batchSize;
    }


    flush(): Promise<Array<T>> {
        this.stats.reportProgress('batches', 1);
        this.stats.reportProgress('batched items', this.currentBatch.length);
        return Promise.resolve(this.currentBatch);
    }

    process(item: T): Promise<Array<T>> {
        this.currentBatch.push(item);
        if (this.currentBatch.length >= this.batchSize)
            return this.flushBatch();
        else
            return Promise.resolve(undefined);
    }

    flushBatch() {
        let completedBatch = this.currentBatch;
        this.currentBatch = [];
        this.stats.reportProgress('batches', 1);
        this.stats.reportProgress('batched items', completedBatch.length);
        return Promise.resolve(completedBatch);
    }

}