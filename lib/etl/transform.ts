import {Next} from "./source";
import Queue from 'promise-queue';
import {Statistics} from "../util/statistics";

export abstract class Transform<T, S> implements Next<T> {
    protected readonly next: Next<S>;
    private readonly isDone: Promise<void>;
    protected resolveIsDone: () => void;

    private readonly concurrency: number;
    private readonly queueLimit: number;
    private queue: any;
    private waitingForQueueSpace: Promise<void>;
    private waitingForQueueSpaceResolve: (value: (PromiseLike<void> | void)) => void = undefined;

    private queued: number = 0;
    private startedProcessing: number = 0;
    private completedProcessing: number = 0;
    private noMoreInputs = false;

    protected readonly stats: Statistics;

    protected constructor(next: Next<S>, concurrency: number, queueLimit: number, stats: Statistics) {
        this.next = next;
        this.concurrency = concurrency;
        this.queueLimit = queueLimit;
        this.stats = stats;
        this.isDone = new Promise(resolve => {
            this.resolveIsDone = resolve;
        });
        this.queue = new Queue(concurrency, Infinity);

    }

    abstract process(item: T): Promise<S | undefined>
    abstract flush(): Promise<S | undefined>

    async handleItem(item): Promise<void> {
        await this.availableSpaceForQueued();
        this.queued += 1;
        this.queue.add(async() => {
            this.queued -= 1;
            this.startedProcessing += 1;
            this.freeQueuedSpace();
            try {
                let processResult: S | undefined = await this.process(item)
                if (processResult !== undefined)
                    await this.next.handleItem(processResult);
            }
            finally {
                this.completedProcessing += 1;
                await this.checkIsDone();
            }
        })
    }

    noMoreItems(): void {
        this.noMoreInputs = true;
        this.checkIsDone();
    }

    done(): Promise<void> {
        return this.isDone;
    }

    private async checkIsDone() {
        if (this.noMoreInputs && this.queued + this.startedProcessing === this.completedProcessing) {
            let processResult: S = await this.flush();
            await this.next.handleItem(processResult);
            this.markAsDone();
        }
    }

    private freeQueuedSpace() {
        if (this.waitingForQueueSpaceResolve !== undefined) {
            this.waitingForQueueSpaceResolve();
            this.waitingForQueueSpaceResolve = undefined;
            this.waitingForQueueSpace = undefined;
        }
    }

    private async availableSpaceForQueued(): Promise<void> {
        if (this.queued < this.queueLimit)
            return Promise.resolve();
        else {
            if (!this.waitingForQueueSpace)
                this.waitingForQueueSpace = new Promise(resolve =>
                    this.waitingForQueueSpaceResolve = resolve)

            return this.waitingForQueueSpace;
        }
    }

    private markAsDone() {
        this.next.noMoreItems();
        this.resolveIsDone();
    }

}

