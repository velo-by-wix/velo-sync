import {Config} from "../config";
import crypto from "crypto";
import axios from "axios";
import logger from "../util/logger";

function dateReplacer(key, value) {
    let v = this[key];
    if (v instanceof Date)
        return 'Date('+v.getTime()+')';
    else
        return value
}

async function post(url, payload) {
    return await axios.post(url, JSON.stringify(payload, dateReplacer))
}

function sleep(millis) {
    return new Promise(function(resolve) {
        setTimeout(resolve, millis);
    })
}

async function withRetry(description: string, op, shouldRetryPredicate: (error: Error, retryNum: number) => ShouldRetry) {
    let shouldRetry = {doRetry: false, sleepTime: 0};
    let retryNum = 0;
    let errors = [];
    do {
        try {
            return await op();
        }
        catch (e) {
            errors.push(e);
            shouldRetry = shouldRetryPredicate(e, retryNum++);
            if (shouldRetry.doRetry) {
                logger.trace(`    retrying / resuming in ${shouldRetry.sleepTime/1000} sec...`);
                await sleep(shouldRetry.sleepTime);
            }
            else {
                logger.error(`  Error: calling site API - ${description} failed after retry with errors:` +
                    errors.reduce(err => `\n            ${err.message} - ${err?.response?.data}`));
                throw e;
            }
        }
    } while (shouldRetry)
}

interface ShouldRetry {
    doRetry: boolean,
    sleepTime: number
}
const tooManyRequests = /Too many request/;
function shouldRetry(error: Error, retryNum: number): ShouldRetry {
    // @ts-ignore
    if (tooManyRequests.exec(error?.response?.data) !== null && retryNum < 4)
        return {doRetry: true, sleepTime: 60000}
    else if ((
            (error.message === 'Internal wixData error: Failed to parse server response') ||
            (error.message === 'read ECONNRESET') ||
            (error.message === 'Request failed with status code 502'))
            && retryNum < 4)
        return {doRetry: true, sleepTime: 500*retryNum};
    else
        return {doRetry: false, sleepTime: 0};
}

export default async function invokeApi(config: Config, name: string, data: any) {
    const hmac = crypto.createHmac('sha256', config.secret);
    hmac.update(JSON.stringify(data, dateReplacer));
    const payload = {
        data,
        signature: hmac.digest('hex')
    };

    let apiUrl = `${config.siteUrl}/_functions/${name}`;
    let result = await withRetry(`POST - ${apiUrl}`,
        () => post(apiUrl, payload), shouldRetry);
    return result.data;
}