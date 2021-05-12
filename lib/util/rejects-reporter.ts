import logger from "./logger";
import {Statistics} from "./statistics";

export interface RejectsReporter {
    reject(item: any, error: Error): void;
}

export class LoggerRejectsReporter implements RejectsReporter {
    private readonly stats: Statistics;
    constructor(stats: Statistics) {
        this.stats = stats;
    }
    reject(item: any, error: Error): void {
        this.stats.reportProgress('all rejected items', 1)
        logger.error(`Rejected item: ${error.message}\n ${JSON.stringify(item)}`);
    }
}