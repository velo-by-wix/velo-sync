import {Next} from "./source";


class NullNext implements Next<any> {
    handleItem(item: any): Promise<void> {
        return Promise.resolve(undefined);
    }

    noMoreItems(): void {
    }
}

export const End = new NullNext();