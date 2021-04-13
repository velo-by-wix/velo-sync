import logger from './logger';

export function sleep(millis, logger) {
    logger.yellow(`************* throttling - waiting for ${millis} millis`);
    return new Promise(function(resolve) {
        setTimeout(resolve, millis);
    })
}

let credit = 1000;
let usedPrice = 0;
export async function checkThrottling(price) {
    if (usedPrice > credit) {
        // multiple concurrent operations will sleep here
        await sleep(120000, logger);
        // multiple concurrent operations will get here - and we want only the first to reset the usedPrice
        if (usedPrice > credit)
            usedPrice = 0;
    }
    usedPrice += price || 1;
}

