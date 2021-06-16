import {NedbFileUploadCache} from "../state/NedbFileUploadCache";
import {SQLiteFileUploadCache} from "../state/SQLiteFileUploadCache";
import logger from "../util/logger";
import {LoggingStatistics} from "../util/statistics";


export default async function migrateFileCache() {
    let source = new NedbFileUploadCache('./.upload-cache.db');
    let target = new SQLiteFileUploadCache('./.upload-cache.sqlite.db');
    let stats = new LoggingStatistics();

    logger.strong('starting')
    await target.open();
    try {
        await new Promise((resolve, reject) => {
            try {
                source.db.find({}, async function (err, docs) {
                    try {
                        logger.strong(`found ${docs.length} items in cache`)
                        for await (let doc of docs) {
                            stats.reportProgress('migrated file cache', 1);
                            await target.setVeloFileUrl(doc._id, doc.hash, doc.veloFileUrl)
                        }
                        resolve(undefined);
                    }
                    catch (err) {
                        logger.error('error migrating', err)
                        reject(err);
                    }
                })
            }
            catch (err) {
                logger.error('error migrating', err)
                reject(err);
            }
        })
        logger.strong('done migrating !!!')
        stats.print();
    }
    finally {
        await target.close();
    }
}