import readline  from "readline-promise";
import chalk from 'chalk';
import {promises as fs} from 'fs';


export default async function init() {
  const rlp = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  console.log(chalk.bgYellow('hello to velo-sync init'));

  let siteUrl = await rlp.questionAsync('what is the url of the site homepage? ')
  let secret = await rlp.questionAsync('what is the velo-sync secret? ')
  await fs.writeFile('config.json', JSON.stringify({siteUrl, secret}));
  rlp.close();
}
