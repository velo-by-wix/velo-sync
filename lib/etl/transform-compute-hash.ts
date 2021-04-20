import {Transform} from "./transform";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import * as crypto from "crypto";
import {Schema} from "../configurations/schema";

export class TransformComputeHash extends Transform<any, any> {
    private schema: Schema;

    constructor(next: Next<Array<any>>, queueLimit: number, stats: Statistics, schema: Schema) {
        super(next, 1, queueLimit, stats);
        this.schema = schema;
    }


    flush(): Promise<Array<any>> {
        return Promise.resolve(undefined);
    }

    process(item: any): Promise<Array<any>> {
        return Promise.resolve(this.hash(item));
    }

    hash(item: any) {
        let hash = crypto.createHash('md5');
        Object.keys(this.schema.fields).forEach(key => {
            let value = item[key];
            if (value)
                hash.update(value);
        });
        item._hash = hash.digest('hex');
        return item;
    }
}