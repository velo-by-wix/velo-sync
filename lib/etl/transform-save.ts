import {Transform} from "./transform";
import {Config} from "../configurations/config";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import logger from "../util/logger";
import {ItemStatus, ItemWithStatus, saveItemBatch} from "../velo/velo-api";
import {HasHashAndId} from "./transform-normalize-fields";

export class TransformSave extends Transform<Array<ItemWithStatus>, Array<ItemWithStatus>> {
    private readonly config: Config;
    private readonly collection: string;
    private batchNum: number = 0;
    private readonly dryrun: boolean;

    constructor(config: Config, collection: string, next: Next<Array<ItemWithStatus>>, concurrency: number, queueLimit: number,
                stats: Statistics, dryrun: boolean) {
        super(next, concurrency, queueLimit, stats);
        this.config = config;
        this.collection = collection;
        this.dryrun = dryrun;
    }

    flush(): Promise<Array<ItemWithStatus>> {
        return Promise.resolve(undefined);
    }

    async process(item: Array<ItemWithStatus>): Promise<Array<ItemWithStatus>> {
        await this.saveItems(item
            .filter(_ => _.status !== ItemStatus.ok)
            .map(_ => _.item))
        return item;
    }

    async saveItems(batch: Array<HasHashAndId>): Promise<void> {
        let thisBatchNum = this.batchNum++;
        if (batch.length === 0) {
            logger.log(`  saving batch ${thisBatchNum} - skipping batch with no items needing save`)
        }
        else {
            if (!this.dryrun) {
                logger.log(`  saving batch ${thisBatchNum} with ${batch.length} items`)
                let ir = await saveItemBatch(this.config, this.collection, batch);
                logger.trace(`    saving batch ${thisBatchNum} with ${batch.length} items. inserted: ${ir.inserted}, updated: ${ir.updated}, skipped: ${ir.skipped}, errors: ${JSON.stringify(ir.errors)}`)
            }
            else
                logger.log(`  dry-run - skipping batch ${thisBatchNum} save with ${batch.length} items`)
        }
        this.stats.reportProgress('items saved', batch.length);
    }

}