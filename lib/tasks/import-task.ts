import {SCVSourceQueue} from "../engines/source-queue";
import {ImportItemQueue} from "../engines/import-item-queue";
import {readConfig} from "../config";
import logger from '../logger';

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

        let readItems = 0;
        let savedItems = 0;
        let lastReported = 0;
        let source = new SCVSourceQueue(filename);
        let config = await readConfig('config.json');
        let sync = new ImportItemQueue(config, collection, 10, 50);

        sync.onItemDone(numberOfItems => {
            savedItems += numberOfItems;
            if (savedItems > lastReported + 1000) {
                logger.log(`read ${readItems} items, saved ${savedItems} items`)
                lastReported += 1000;
            }
            source.completedHandlingItem(numberOfItems)
        })

        source.onItem(item => {
            readItems += 1;
            sync.importItem(item);
        });
        source.onEnd(async () => {
            sync.flush()
            logger.strong(`completed reading source file ${filename}`);
            logger.log(`read ${readItems} items, saved ${savedItems} items`)
//            resolve();
        });

        source.resume();

        await sync.complete();
        logger.log(`read ${readItems} items, saved ${savedItems} items`);
        resolve();
    })
}