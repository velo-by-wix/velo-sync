import {Statistics} from "./util/statistics";
import {Config} from "./configurations/config";
import {Schema} from "./configurations/schema";
import path from "path";
import {NedbFileUploadCache} from "./state/NedbFileUploadCache";
import {TransformSave} from "./etl/transform-save";
import {End} from "./etl/sink-null";
import {FileUploadCache, TransformImportFiles} from "./etl/transform-import-files";
import {TransformCheckUpdate} from "./etl/transform-check-update";
import {TransformBatch} from "./etl/transform-batch";
import {HasHashAndId, TransformNormalizeFields} from "./etl/transform-normalize-fields";
import {TransformComputeHash} from "./etl/transform-compute-hash";
import {Next} from "./etl/source";
import {Transform} from "./etl/transform";
import {RejectsReporter} from "./util/rejects-reporter";

export {LoggingStatistics, Statistics} from './util/statistics';
export {LoggerRejectsReporter, RejectsReporter} from "./util/rejects-reporter";

export interface DataSync extends Next<Record<string, any>>{
    done(): Promise<void>;
}

class DataSyncImpl implements DataSync {
    private first: Transform<Record<string, any>, Record<string, any>>;
    private last: Transform<Record<string, any>, Record<string, any>>;
    constructor(first: Transform<Record<string, any>, Record<string, any>>, last: Transform<Record<string, any>, Record<string, any>>) {
        this.first = first;
        this.last = last;
    }

    handleItem(item: Record<string, any>): Promise<void> {
        return this.first.handleItem(item);
    }

    noMoreItems(): void {
        return this.first.noMoreItems();
    }

    done(): Promise<void> {
        return this.last.done();
    }

}

export function createDataSync(collection: string, config: Config, schema: Schema, stats: Statistics,
                               filesFolder: string, rejectsReporter: RejectsReporter,
                               uploadFilesCache: FileUploadCache, dryrun: boolean = false): DataSync {
    let importFileFolder = path.dirname(filesFolder);

    let updateItems = new TransformSave(config, collection, End, 5, 10, stats, dryrun);
    let importImages = new TransformImportFiles(config, schema, importFileFolder, collection, updateItems, uploadFilesCache, 5, 10, stats, rejectsReporter, dryrun);
    let checkUpdate = new TransformCheckUpdate(config, collection, importImages, 5, 10, stats, dryrun);
    let batch = new TransformBatch<HasHashAndId>(checkUpdate, 10, stats, 50);
    let normalize = new TransformNormalizeFields(batch, 10, stats, schema, rejectsReporter);
    let hash = new TransformComputeHash(normalize, 10, stats, schema);

    return new DataSyncImpl(hash, updateItems);

}