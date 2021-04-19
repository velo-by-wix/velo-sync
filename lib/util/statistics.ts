import logger from './logger';

export interface Statistics {
    reportProgress(who: string, items: number)
    print();
}

export class LoggingStatistics implements Statistics {
    private stats = {};
    private lastPrintIndex = 0;
    private readonly printIndexSteps = 1000;
    private nextPrintIndex = this.printIndexSteps;
    reportProgress(who: string, items: number) {
        if (this.stats[who] === undefined)
            this.stats[who] = 0;
        this.stats[who] += items;

        this.checkShouldPrint(items);
    }

    private checkShouldPrint(items: number) {
        this.lastPrintIndex += items;
        if (this.lastPrintIndex >= this.nextPrintIndex) {
            this.nextPrintIndex += this.printIndexSteps;
            this.print();
        }
    }

    print() {
        logger.log('statistics');
        Object.keys(this.stats).forEach(key =>
            logger.log(`  ${key}: ${this.stats[key]}`)
        )
    }
}