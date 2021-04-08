import {promises as fs} from 'fs';

export interface Config {
    siteUrl: string,
    secret: string
}

export async function saveConfig(config: Config, file: string) {
    await fs.writeFile(file, JSON.stringify(config));
}

export async function readConfig(file: string): Promise<Config> {
    let content = await fs.readFile(file, 'utf-8');
    return JSON.parse(content) as Config;
}