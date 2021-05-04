




export interface TryOp<T, S> {
    isOk(): boolean;
}

export class Success<S> implements TryOp<any, S>{
    readonly item: S;
    constructor(item: S) {
        this.item = item;
    }

    isOk(): boolean {
        return true;
    }
}

export class Failure<T> implements TryOp<T, any>{
    readonly error: Error;
    readonly item: T;
    constructor(error: Error, item: T) {
        this.error = error;
        this.item = item;
    }

    isOk(): boolean {
        return false;
    }
}

export async function tryProcessItem<T, S>(item: T, op: (T) => Promise<S>): Promise<TryOp<T, S>> {
    try {
        return new Success(await op(item));
    }
    catch (e) {
        return new Failure(e, item);
    }
}