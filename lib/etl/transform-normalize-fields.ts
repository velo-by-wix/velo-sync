import {Transform} from "./transform";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import {Schema} from "../configurations/schema";
import {HasHash} from "./transform-compute-hash";
import {camelCase} from 'change-case';
import {RejectsReporter} from "../util/rejects-reporter";
import {Failure, Success, tryProcessItem} from "../util/try";
import {ItemWithStatus} from "../velo/velo-api";
export interface HasHashAndId extends HasHash {
    _id: string
}

/**
 * transform values for reading values from CSV
 * * string
 * * number - default number parsing
 * * boolean - parses y, yes and true as true, n, no and false as false
 * * DateTime - as javascript Date, expects '2021-04-07T21:00:00Z'
 * * Time - expects '11:30:00.000'
 * * Tags - parses json, expects ["one","bla","some"]
 * * Address - parses json, expects {"city":"Jersey City","location":{"latitude":40.7177545,"longitude":-74.0431435},"streetAddress":{"number":"","name":"","apt":""},"formatted":"Jersey City, NJ, USA","country":"US","subdivision":"NJ"}
 * * Array, Object - parses json
 * * Gallery - can be either a gallery json object or a list of urls
 *   - gallery json - [{"slug":"11062b_3e9b458a96de408e88ef309728ed98be~mv2","src":"wix:image://v1/11062b_3e9b458a96de408e88ef309728ed98be~mv2.jpg/eggs#originWidth=6720&originHeight=4480","title":"","type":"image","settings":{}},{"slug":"11062b_82b7c98240e643db9c54e81f2e8475ee~mv2","src":"wix:image://v1/11062b_82b7c98240e643db9c54e81f2e8475ee~mv2.jpg/grey-cat#originWidth=3845&originHeight=2884","title":"","type":"image","settings":{}},{"slug":"5eb203c1e4034e9480941b8cc8ce907b","src":"wix:image://v1/5eb203c1e4034e9480941b8cc8ce907b.jpg/easter-preparations#originWidth=5600&originHeight=3737","title":"","type":"image","settings":{}}]
 *   - list of urls - http://image1.jpg, file:///image2.jpg, http://image3.jpg
 */
export class TransformNormalizeFields extends Transform<HasHash, HasHashAndId> {
    private schema: Schema;
    private rejectsReporter: RejectsReporter;

    constructor(next: Next<object>, queueLimit: number, stats: Statistics, schema: Schema, rejectsReporter: RejectsReporter) {
        super(next, 1, queueLimit, stats);
        this.schema = schema;
        this.rejectsReporter = rejectsReporter;
    }


    flush(): Promise<HasHashAndId> {
        return Promise.resolve(undefined);
    }

    process(item: HasHash): Promise<HasHashAndId> {
        return this.normalize(item);
    }

    async normalize(item: HasHash): Promise<HasHashAndId> {
        let processedItem = await tryProcessItem(item, item => {
            if (this.schema.keyField)
                item._id = ''+item[this.schema.keyField];
            Object.keys(this.schema.fields).forEach(key => {
                if (item[key] === undefined || item[key] === null || item[key] === '')
                    item[key] = undefined;
                else
                    switch (this.schema.fields[key]) {
                        case 'number': item[key] = parseNumber(item[key], key); break;
                        case 'boolean': item[key] = parseBoolean(item[key], key); break;
                        case 'Datetime': item[key] = parseDate(item[key], key); break;
                        case 'Array': item[key] = parseJson(item[key], key); break;
                        case 'Object': item[key] = parseJson(item[key], key); break;
                        case 'Address': item[key] = parseJson(item[key], key); break;
                        case 'Tags': item[key] = parseJson(item[key], key); break;
                        case 'Gallery': item[key] = parseGallery(item[key]); break;
                    }
                let normalizedKey = camelCase(key);
                if (normalizedKey !== key) {
                    let val = item[key];
                    delete item[key];
                    item[normalizedKey] = val;
                }
            });
            return Promise.resolve(item as HasHashAndId);
        })
        if (!processedItem.isOk()) {
            let failure = processedItem as Failure<ItemWithStatus>;
            this.stats.reportProgress('parse CSV fields - field parsing failed', 1);
            this.rejectsReporter.reject(failure.item, failure.error);
        }
        else
            return (processedItem as Success<HasHashAndId>).item;
    }
}

const parseYes = /^(y|yes|true)$/i;
const parseNo = /^(n|no|false)$/i;
function parseNumber(val: string, key: string): number {
    let num = Number(val);
    if (Number.isNaN(num))
        throw new Error(`Failed to parse field ${key} - "${val}" is not a number`);
    return num;
}

function parseBoolean(val: string | boolean, key: string): boolean {
    if (val === "")
        return undefined;
    if (typeof val === 'boolean')
        return val;
    if (val.match(parseYes))
        return true
    else if (val.match(parseNo))
        return false;
    else
        throw new Error(`Failed to parse field ${key} - "${val}" is not a boolean`);
}

function parseJson(val: string | object, key: string): any {
    if (val === "")
        return undefined;
    if (typeof val === 'object')
        return val;
    try {
        return JSON.parse(val)
    }
    catch (e) {
        throw new Error(`Failed to parse field ${key} - "${val}" is not a valid object json`);
    }
}

function parseDate(val: string | Date, key: string): Date {
    if (val === "")
        return undefined;
    if (val instanceof Date)
        return val;
    let d = new Date(val);
    if (isNaN(d.getTime()))
        throw new Error(`Failed to parse field ${key} - "${val}" is not a valid Datetime`);
    return d;
}

function parseGallery(val: string | object) {
    if (val === "")
        return undefined;
    if (typeof val === 'object')
        return val;
    try {
        return JSON.parse(val)
    }
    catch (e) {
        return val.split(',').map(url => {
            return {
                src: url,
                type: isImage(url)?'image':'video'
            }
        })
    }
}

const imageExtensions = /\.(png|jpg|jpeg|bmp|gif|eps|webp)[?#]?/i;
function isImage(val: string): boolean {
    return !!val.match(imageExtensions);
}
