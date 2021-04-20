import {readConfig} from "../config";
import logger from '../util/logger';
import {LoggingStatistics} from '../util/statistics';

import {SCVSourceQueue} from "../etl/source-scv";
import {TransformBatch} from "../etl/transform-batch";
import {End} from "../etl/sink-null";
import {InsertData} from "../etl/transform-insert-data";
import {TransformComputeHash} from "../etl/transform-compute-hash";
import {TransformNormalizeFields} from "../etl/transform-normalize-fields";

export default async function importTask(filename: string, collection: string) {
    try {
        logger.strong(`starting import ${filename} to ${collection}`);
        await runImport(filename, collection);
        logger.strong(`completed importing ${filename} to ${collection}`);
    }
    catch (e) {
        logger.error(`failed importing ${filename} to ${collection} with ${e}`)
    }
}

function runImport(filename: string, collection: string) {
    return new Promise<void>(async resolve => {

        let stats = new LoggingStatistics();
        let config = await readConfig('config.json');

        let insert = new InsertData(config, collection, End, 5, 10, stats);
        let batch = new TransformBatch(insert, 10, stats, 50);
        let normalize = new TransformNormalizeFields(batch, 10, stats, schema);
        let hash = new TransformComputeHash(normalize, 10, stats, schema);
        let source = new SCVSourceQueue(filename, hash, stats);

        await source.done();
        await batch.done();
        await insert.done();
        stats.print();
        // logger.log(`read ${readItems} items, saved ${savedItems} items`);
        resolve();
    })
}