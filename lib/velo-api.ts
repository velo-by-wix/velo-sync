import {Config} from "./config";
import invokeApi from "./invoke-velo-api";

export async function isAlive(config: Config) {
    let res = await invokeApi(config, 'isAlive', {isAlive: '?'});
    if (res !== 'ok')
        throw new Error(`failed to call isAlive API - got response ${res} but expecting 'ok'`);
}