import {readConfig} from "../configurations/config";
import logger from '../util/logger';
import {LoggingStatistics} from '../util/statistics';

import {SCVSourceQueue} from "../etl/source-scv";
import {readSchema} from "../configurations/schema";
import {removeStaleItems} from "../velo/velo-api";
import {createDataSync} from "../index";

export default async function syncTask(filename: string, collection: string, schemaFilename: string, importOnly: boolean) {
    try {
        logger.strong(`starting import ${filename} to ${collection}`);
        await runImport(filename, collection, schemaFilename, importOnly);
        logger.strong(`completed importing ${filename} to ${collection}`);
    }
    catch (e) {
        logger.error(`failed importing ${filename} to ${collection} with ${e}`)
    }
}

function runImport(filename: string, collection: string, schemaFilename: string, importOnly: boolean) {
    return new Promise<void>(async resolve => {

        let stats = new LoggingStatistics();
        let config = await readConfig('config.json');
        let schema = await readSchema(schemaFilename)

        let dataSync = createDataSync(collection, config, schema, stats, filename)
        let source = new SCVSourceQueue(filename, dataSync, stats);

        await source.done();
        await dataSync.done();
        stats.print();

        if (!importOnly) {
            let pendingItems = 0;
            do {
                let clearStaleResult = await removeStaleItems(config, collection);
                pendingItems = clearStaleResult.staleItems;
                logger.trace(`clearing stale items. removed: ${clearStaleResult.itemsRemoved}, stale: ${clearStaleResult.staleItems}`)
                stats.reportProgress('remove stale items', clearStaleResult.itemsRemoved);
            }
            while (pendingItems > 0)
        }
        resolve();
    })
}