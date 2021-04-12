import {Config} from "../config";
import crypto from "crypto";
import axios from "axios";
import logger from "../logger";

function dateReplacer(key, value) {
    let v = this[key];
    if (v instanceof Date)
        return 'Date('+v.getTime()+')';
    else
        return value
}

async function post(url, payload) {
    try {
        return await axios.post(url, JSON.stringify(payload, dateReplacer))
    }
    catch (err) {
        logger.error(`    Error: calling site API - POST ${url} \n      ${err.message}`);
        throw err;
    }
}

function sleep(millis) {
    return new Promise(function(resolve) {
        setTimeout(resolve, millis);
    })
}

async function withRetry(op, shouldRetryPredicate) {
    let shouldRetry = false;
    let retryNum = 0;
    do {
        try {
            return await op();
        }
        catch (e) {
            shouldRetry = shouldRetryPredicate(e, retryNum++);
            logger.trace('  retrying...');
            if (shouldRetry) {
                await sleep(500*retryNum);
            }
            else {
                logger.trace('  another error', e.stack);
                throw e;
            }
        }
    } while (shouldRetry)
}

function shouldRetry(error, retryNum) {
    return (
        (error.message === 'Internal wixData error: Failed to parse server response') ||
        (error.message === 'read ECONNRESET') ||
        (error.message === 'Request failed with status code 502'))
        && retryNum < 4;
}

export default async function invokeApi(config: Config, name: string, data: any) {
    const hmac = crypto.createHmac('sha256', config.secret);
    hmac.update(JSON.stringify(data, dateReplacer));
    const payload = {
        data,
        signature: hmac.digest('hex')
    };

    let apiUrl = `${config.siteUrl}/_functions/${name}`;
    let result = await withRetry(
        () => post(apiUrl, payload), shouldRetry);
    return result.data;
}