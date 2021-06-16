import {FileUploadCache} from "../etl/transform-import-files";
import sqlite3, {Database} from 'sqlite3';
import {promisify} from 'util';
import logger from "../util/logger";

const promiseCallbacks = (reject, resolve) => (err) => {
    if (err)
        reject(err);
    else
        resolve();
}

export class SQLiteFileUploadCache implements FileUploadCache {
    private readonly filename: string;
    private db: Database;
    private run: (sql: string, ...params: any[]) => Promise<void>;
    private exec: (sql: string) => Promise<void>;
    private get: (sql: string, ...params: any[]) => Promise<any>;
    private _close: () => Promise<void>;

    constructor(filename: string) {
        this.filename = filename;
    }

    async open(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.db = new Database(this.filename,
                promiseCallbacks(reject, resolve));
        })
        this.run = promisify(this.db.run).bind(this.db);
        this.exec = promisify(this.db.exec).bind(this.db);
        this.get = promisify(this.db.get).bind(this.db);
        this._close = promisify(this.db.close).bind(this.db);

        await this.exec('CREATE TABLE IF NOT EXISTS file_cache(file_url_or_path text PRIMARY KEY, hash text, velo_file_url text)');
    }

    async close(): Promise<void> {
        logger.strong('closing database')
        await this._close();
    }

    async getVeloFileUrl(fileUrlOrPath: string, hash: string): Promise<string> {
        let row = await this.get("select * from file_cache where file_url_or_path = ?", [fileUrlOrPath])
        if (row && row.hash === hash)
            return row.velo_file_url;
        else
            return undefined;
    }

    async setVeloFileUrl(fileUrlOrPath: string, hash: string, veloFileUrl: string): Promise<void> {
        return this.run('insert or replace into file_cache values (?, ?, ?)', [fileUrlOrPath, hash, veloFileUrl])
    }

}