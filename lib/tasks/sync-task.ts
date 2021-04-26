import {readConfig} from "../configurations/config";
import logger from '../util/logger';
import {LoggingStatistics} from '../util/statistics';

import {SCVSourceQueue} from "../etl/source-scv";
import {TransformBatch} from "../etl/transform-batch";
import {End} from "../etl/sink-null";
import {TransformComputeHash} from "../etl/transform-compute-hash";
import {HasHashAndId, TransformNormalizeFields} from "../etl/transform-normalize-fields";
import {readSchema} from "../configurations/schema";
import {TransformCheckUpdate} from "../etl/transform-check-update";
import {NoopFileUploadCache, TransformImportFiles} from "../etl/transform-import-files";
import {TransformSave} from "../etl/transform-save";
import {removeStaleItems} from "../velo/velo-api";
import path from 'path';
import {PersistentFileUploadCache} from "../state/PersistentFileUploadCache";

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

        let importFileFolder = path.dirname(filename);
        let fileUploadCache = new PersistentFileUploadCache('.upload-cache.db');

        let updateItems = new TransformSave(config, collection, End, 5, 10, stats);
        let importImages = new TransformImportFiles(config, schema, importFileFolder, collection, updateItems, fileUploadCache, 5, 10, stats);
        let checkUpdate = new TransformCheckUpdate(config, collection, importImages, 5, 10, stats);
        let batch = new TransformBatch<HasHashAndId>(checkUpdate, 10, stats, 50);
        let normalize = new TransformNormalizeFields(batch, 10, stats, schema);
        let hash = new TransformComputeHash(normalize, 10, stats, schema);
        let source = new SCVSourceQueue(filename, hash, stats);

        await source.done();
        await batch.done();
        await checkUpdate.done();
        await updateItems.done();
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