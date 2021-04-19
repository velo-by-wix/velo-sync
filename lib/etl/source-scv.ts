import {Readable} from "stream";
import fs from "fs";
import csv from "csv-parser";
import {Next, Source} from "./source";
import {Statistics} from "../util/statistics";

export class SCVSourceQueue extends Source<any> {
    private stream: Readable;

    constructor(filename: string, next: Next<any>, stats: Statistics) {
        super(next, stats);
        this.stream = fs
            .createReadStream(filename)
            .pipe(csv());

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