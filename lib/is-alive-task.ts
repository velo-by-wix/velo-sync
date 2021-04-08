import {readConfig} from "./config";
import chalk from 'chalk';
import {isAlive} from "./velo-api";

export default async function isAliveTask() {
    try {
        let config = await readConfig('config.json');
        console.log(`checking if the API for site ${chalk.greenBright(config.siteUrl)} is alive...`);
        await isAlive(config)
        console.log(chalk.green(`API of site ${chalk.greenBright(config.siteUrl)} is working and alive!!!`));
    }
    catch (e) {
        console.error(chalk.red(e.message));
    }
}