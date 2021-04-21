import {Transform} from "./transform";
import {Config} from "../configurations/config";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import logger from "../util/logger";
import {checkUpdateState, ItemStatus, ItemWithStatus} from "../velo/velo-api";
import {HasHashAndId} from "./transform-normalize-fields";


export class TransformCheckUpdate extends Transform<Array<HasHashAndId>, Array<ItemWithStatus>> {
    private readonly config: Config;
    private readonly collection: string;
    private batchNum: number = 0;
    constructor(config: Config, collection: string, next: Next<any>, concurrency: number, queueLimit: number, stats: Statistics) {
        super(next, concurrency, queueLimit, stats);
        this.config = config;
        this.collection = collection;
    }

    flush(): Promise<Array<ItemWithStatus>> {
        return Promise.resolve(undefined);
    }

    process(item: Array<HasHashAndId>): Promise<Array<ItemWithStatus>> {
        return this.checkUpdateState(item);
    }

    async checkUpdateState(batch: Array<HasHashAndId>): Promise<Array<ItemWithStatus>> {
        let thisBatchNum = this.batchNum++;
        logger.trace(`  check update state batch ${thisBatchNum} with ${batch.length} items`)
        let itemStatuses = await checkUpdateState(this.config, this.collection, batch);
        let {ok, needUpdate, notFound} = itemStatuses.reduce((aggregate, itemWithStatus) => {
            if (itemWithStatus.status === ItemStatus.ok)
                aggregate.ok++;
            if (itemWithStatus.status === ItemStatus.needUpdate)
                aggregate.needUpdate++;
            if (itemWithStatus.status === ItemStatus.notFound)
                aggregate.notFound++;
            return aggregate;
        }, {ok:0, needUpdate:0, notFound:0});

        logger.trace(`    check update state batch ${thisBatchNum} with ${batch.length} items. ok: ${ok}, need update: ${needUpdate}, not found: ${notFound}`)
        this.stats.reportProgress('check update state', batch.length);
        return itemStatuses;
    }


}