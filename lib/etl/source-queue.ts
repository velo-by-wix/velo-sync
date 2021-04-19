export interface SourceQueue {
    onItem(handler: (item) => void);

    onEnd(handler: () => void);

    completedHandlingItem(numberOfItems: number)
}

