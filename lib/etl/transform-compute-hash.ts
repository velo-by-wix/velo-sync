import {Transform} from "./transform";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import {Schema} from "../configurations/schema";
import hash from 'object-hash';

export interface HasHash extends Record<string, any> {
    _hash: string
}

export class TransformComputeHash extends Transform<Record<string, any>, HasHash> {
    private schema: Schema;

    constructor(next: Next<HasHash>, queueLimit: number, stats: Statistics, schema: Schema) {
        super(next, 1, queueLimit, stats);
        this.schema = schema;
    }


    flush(): Promise<HasHash> {
        return Promise.resolve(undefined);
    }

    process(item: Record<string, any>): Promise<HasHash> {
        return Promise.resolve(this.hash(item));
    }

    hash(item: Record<string, any>): HasHash {
        item._hash = hash(item);
        return item as object & HasHash;
    }
}