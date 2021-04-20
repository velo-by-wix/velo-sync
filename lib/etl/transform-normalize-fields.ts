import {Transform} from "./transform";
import {Next} from "./source";
import {Statistics} from "../util/statistics";
import {URL} from 'url';
import * as path from "path";

type FieldType = 'string' | 'number' | 'boolean' | 'Image' | 'Datetime' | 'Time' | 'RichText' | 'Reference' | 'URL' | 'Document' | 'Video' |
    'Audio' | 'Address' | 'Tags' | 'Array' | 'Object' | 'Gallery';
export interface Schema {
    [key: string]: FieldType
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
export class TransformNormalizeFields extends Transform<any, any> {
    private schema: Schema;

    constructor(next: Next<Array<any>>, queueLimit: number, stats: Statistics, schema: Schema) {
        super(next, 1, queueLimit, stats);
        this.schema = schema;
    }


    flush(): Promise<Array<any>> {
        return Promise.resolve(undefined);
    }

    process(item: any): Promise<Array<any>> {
        return Promise.resolve(this.normalize(item));
    }

    normalize(item: any) {
        Object.keys(this.schema).forEach(key => {
            try {
                switch (key) {
                    case 'number': item[key] = Number(item[key]); break;
                    case 'boolean': item[key] = parseBoolean(item[key]); break;
                    case 'Datetime': item[key] = parseDate(item[key]); break;
                    case 'Array': item[key] = parseJson(item[key]); break;
                    case 'Object': item[key] = parseJson(item[key]); break;
                    case 'Address': item[key] = parseJson(item[key]); break;
                    case 'Tags': item[key] = parseJson(item[key]); break;
                    case 'Gallery': item[key] = parseGallery(item[key]); break;
                }
            }
            catch (e) {}
        });
        return item;
    }
}

const parseYes = /^(y|yes|true)$/i;
const parseNo = /^(n|no|false)$/i;
function parseBoolean(val: string): boolean | string {
    if (val.match(parseYes))
        return true
    else if (val.match(parseNo))
        return false;
    else
        return val;
}

function parseJson(val: string): any {
    return JSON.parse(val)
}

function parseDate(val: string): Date {
    return new Date(val);
}

function parseGallery(val: string) {
    try {
        return JSON.parse(val)
    }
    catch (e) {
        val.split(',').map(url => {
            return {
                url,
                type: isImage(url)?'image':'video'
            }
        })
    }
}

const imageExtensions = /^\.(png|jpg|jpeg|bmp|gif|eps|webp)$/i;
function isImage(val: string): boolean {
    let url = new URL(val);
    let ext = path.extname(url.pathname);
    return !!ext.match(imageExtensions);
}
