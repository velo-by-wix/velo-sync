

export async function forEach<T, S>(arr: Array<T>, op: (T) => Promise<S>): Promise<Array<S>> {
    let result: Array<S> = [];
    for (let item of arr)
        result.push(await op(item))
    return result;
}