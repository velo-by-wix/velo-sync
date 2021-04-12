import {Readable} from "stream";
import fs from "fs";
import csv from "csv-parser";

export interface SourceQueue {
    onItem(handler: (item) => void);

    onEnd(handler: () => void);

    completedHandlingItem(numberOfItems: number)
}

export class SCVSourceQueue implements SourceQueue {
    private stream: Readable;
    private onItemHandler: (item) => void;
    private onEndHandler: () => void;
    private handling: number = 0;
    private readAhead: number;

    constructor(filename: string, readAhead: number = 1000) {
        this.readAhead = readAhead;
        this.stream = fs
            .createReadStream(filename)
            .pipe(csv());

        this.stream.on('data', data => {
            this.onItemHandler(data);
            this.handling += 1;
            if (this.handling >= this.readAhead)
                this.stream.pause();
        })
            .on('end', () => {
                this.onEndHandler();
            })
    }

    completedHandlingItem(numberOfItems: number) {
        this.handling -= numberOfItems;
        this.stream.resume();
    }

    onEnd(handler: () => void) {
        this.onEndHandler = handler;
    }

    onItem(handler: (item) => void) {
        this.onItemHandler = handler;
    }
}