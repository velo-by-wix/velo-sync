import {Transform} from "./transform";
import {Next} from "./source";
import {Statistics} from "../util/statistics";


export class TransformBatch extends Transform<any, Array<any>> {
    private currentBatch: Array<any> = [];
    private batchSize: number;

    constructor(next: Next<Array<any>>, queueLimit: number, stats: Statistics, batchSize: number) {
        super(next, 1, queueLimit, stats);
        this.batchSize = batchSize;
    }


    flush(): Promise<Array<any>> {
        this.stats.reportProgress('batches', 1);
        this.stats.reportProgress('batched items', this.currentBatch.length);
        return Promise.resolve(this.currentBatch);
    }

    process(item: any): Promise<Array<any>> {
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