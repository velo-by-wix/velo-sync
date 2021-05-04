import chalk from 'chalk';
import {createWriteStream} from 'fs';
import PromiseWritable from 'promise-writable';
import {inspect} from 'util';

const start = new Date().getTime();

function time() {
  return new Date().getTime() - start;
}

function logMaker(color) {
  return function (...args) {
    let message = args.map(_ => _?_.toString():'').join(' ');
    console.log(color(formatTime(time())), '  ', color(message));
  }
}

function formatTime(timeMillis) {
  const hours = Math.floor(timeMillis/1000/60/60);
  const minutes = Math.floor((timeMillis - hours*1000*60*60) / 1000/60);
  const seconds = Math.floor((timeMillis - hours*1000*60*60 - minutes*1000*60) / 1000);
  return `${hours}:${minutes}:${seconds}`;
}

function dump(arg) {
  console.log(inspect(arg, {colors:true, depth: 5}));
}

const logger = {
  log: logMaker(chalk.white),
  error: logMaker(chalk.red),
  warn: logMaker(chalk.yellow),
  trace: logMaker(chalk.gray),
  strong: logMaker(chalk.whiteBright),
  strongGreen: logMaker(chalk.greenBright),
  formatTime: formatTime,
  dump: dump
};

export default logger;