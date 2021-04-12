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
        await sleep(120000, logger);
        usedPrice = 0;
    }
    usedPrice += price || 1;
}

