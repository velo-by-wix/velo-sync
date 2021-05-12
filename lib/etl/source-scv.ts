import {Readable} from "stream";
import fs from "fs";
import * as csv from 'fast-csv';
import {Next, Source} from "./source";
import {Statistics} from "../util/statistics";
import {RejectsReporter} from "../util/rejects-reporter";
import logger from "../util/logger";

export class SCVSourceQueue extends Source<Record<string, any>> {
    private stream: Readable;
    private rejectsReporter: RejectsReporter;

    constructor(filename: string, next: Next<Record<string, any>>, stats: Statistics, rejectsReporter: RejectsReporter) {
        super(next, stats);
        this.rejectsReporter = rejectsReporter;
        this.stream = fs
            .createReadStream(filename)
            .pipe(csv.parse({headers: true, trim: true, strictColumnHandling: true}));

        this.stream.on('data', data => {
            this.stream.pause();
            this.next.handleItem(data).then(() => {
                this.stream.resume();
            });
            this.stats.reportProgress('read csv', 1);
        })
            .on('data-invalid', rejectedItem => {
                this.stats.reportProgress('read csv', 1);
                this.stats.reportProgress('read csv - invalid lines', 1);
                rejectsReporter.reject(rejectedItem, new Error('failed to read item from CSV due to wrong number of comma separated fields'))
            })
            .on('error', error => logger.error(error))
            .on('end', () => {
                this.markAsDone();
            })
    }
}