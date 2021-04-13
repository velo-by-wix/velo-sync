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

        let source = new SCVSourceQueue(filename);
        let config = await readConfig('config.json');
        let sync = new ImportItemQueue(config, collection, 3, 50);

        sync.onItemDone(numberOfItems => source.completedHandlingItem(numberOfItems))

        source.onItem(item => {
            sync.importItem(item);
        });
        source.onEnd(async () => {
            sync.flush()
            resolve();
        });

        source.resume();
    })
}