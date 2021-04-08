import {Config} from "./config";
import invokeApi from "./invoke-velo-api";

export async function isAlive(config: Config) {
    return await invokeApi(config, 'isAlive', {isAlive: 'q'});
}