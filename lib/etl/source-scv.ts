import {Readable} from "stream";
import fs from "fs";
import * as csv from 'fast-csv';
import {Next, Source} from "./source";
import {Statistics} from "../util/statistics";

export class SCVSourceQueue extends Source<Record<string, any>> {
    private stream: Readable;

    constructor(filename: string, next: Next<Record<string, any>>, stats: Statistics) {
        super(next, stats);
        this.stream = fs
            .createReadStream(filename)
            .pipe(csv.parse({headers: true, trim: true}));

        this.stream.on('data', data => {
            this.stream.pause();
            this.next.handleItem(data).then(() => {
                this.stream.resume();
            });
            this.stats.reportProgress('read csv', 1);
        })
            .on('end', () => {
                this.markAsDone();
            })
    }
}