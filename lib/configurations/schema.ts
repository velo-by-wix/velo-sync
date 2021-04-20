import {promises as fs} from "fs";

type FieldType =
    'string'
    | 'number'
    | 'boolean'
    | 'Image'
    | 'Datetime'
    | 'Time'
    | 'RichText'
    | 'Reference'
    | 'URL'
    | 'Document'
    | 'Video'
    | 'Audio'
    | 'Address'
    | 'Tags'
    | 'Array'
    | 'Object'
    | 'Gallery';

export interface Schema {
    keyField: string,
    fields: {
        [key: string]: FieldType
    }
}

export async function readSchema(file: string): Promise<Schema> {
    let content = await fs.readFile(file, 'utf-8');
    return JSON.parse(content) as Schema;
}