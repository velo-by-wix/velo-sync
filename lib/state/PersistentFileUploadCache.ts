import {FileUploadCache} from "../etl/transform-import-files";
import Datastore from 'nedb';

export class PersistentFileUploadCache implements FileUploadCache {
    private readonly db: any;
    
    constructor(filename: string) {
        this.db = new Datastore({ filename, autoload: true });
    }
    
    getVeloFileUrl(fileUrlOrPath: string, hash: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.db.findOne({ _id: fileUrlOrPath }, function (err, doc) {
                if (err)
                    reject(err);
                else {
                    if (doc && doc.hash === hash)
                        resolve(doc.veloFileUrl)
                    else
                        resolve(undefined);
                }
            });
        })
    }

    setVeloFileUrl(fileUrlOrPath: string, hash: string, veloFileUrl: string): Promise<void> {
        let db = this.db;
        return new Promise((resolve, reject) => {
            db.update({_id: fileUrlOrPath}, {_id: fileUrlOrPath, hash, veloFileUrl}, {upsert: true}, function (err, newDoc) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        })
    }

}