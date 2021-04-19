import {Statistics} from "../util/statistics";

export interface Next<T> {
    handleItem: (item: T) => Promise<void>
    noMoreItems: () => void
}

export class Source<T> {
    protected readonly next: Next<T>;
    private readonly isDone: Promise<void>;
    protected resolveIsDone: () => void;
    protected readonly stats: Statistics;

    constructor(next: Next<T>, stats: Statistics) {
        this.stats = stats;
        this.next = next;
        this.isDone = new Promise(resolve => {
            this.resolveIsDone = resolve;
        });
    }

    done(): Promise<void> {
        return this.isDone;
    }

    protected markAsDone() {
        this.next.noMoreItems();
        this.resolveIsDone();
    }
}

