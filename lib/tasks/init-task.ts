import readline  from "readline-promise";
import chalk from 'chalk';
import {saveConfig} from "../configurations/config";


export default async function initTask() {
  const rlp = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  console.log(chalk.yellow('hello to velo-sync init'));

  let siteUrl = await rlp.questionAsync('what is the url of the site homepage? ')
  let secret = await rlp.questionAsync('what is the velo-sync secret? ')
  let config = {siteUrl, secret};
  await saveConfig(config, 'config.json')
  rlp.close();
}
