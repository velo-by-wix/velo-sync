import optimist from 'optimist';
import initTask from './tasks/init-task';
import isAliveTask from "./tasks/is-alive-task";
import syncTask from "./tasks/sync-task";
import migrateFileCache from "./tasks/migrate-files-cache-task";

if (process.argv.length < 3) {
  printUsage();
  process.exit(1);
}

let command = process.argv[2];

function syncOrImportTask(importOnly: boolean) {
  let argv = optimist
      .usage(`Usage: $0 ${importOnly?'import':'sync'} -f <scv filename> -c <collection>`)
      .demand('f')
      .alias('f', 'filename')
      .describe('f', 'csv filename to import')
      .demand('c')
      .describe('c', 'the name of the collection to import into')
      .alias('c', 'collection')
      .demand('s')
      .describe('s', 'schema file describing the fields of the collection')
      .alias('s', 'schema')
      .describe('dry', 'dry-run that does not upload any data or files, and does not remove or update anything on the site')
      .alias('dry', 'dryrun')
      .parse(process.argv.slice(3));

  let filename = argv.filename;
  let collection = argv.collection;
  let schema = argv.schema;
  let dryrun = argv.dryrun;

  syncTask(filename, collection, schema, importOnly, dryrun);
}

if (command === 'init') {
  initTask();
}
else if (command === 'is-alive') {
  isAliveTask();
}
else if (command === 'sync') {
  syncOrImportTask(false);
}
else if (command === 'import') {
  syncOrImportTask(true);
}
else if (command === 'export') {
  // runExport();
}
else if (command === 'migrate') {
  migrateFileCache();
}
else {
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.log('Usage:  ');
  console.log('  npx velo-sync [command] [options...]');
  console.log('');
  console.log('Commands:');
  console.log('  init          generates a config file for the import / export / sync process');
  console.log('  is-alive      tests the config and the connection to the site');
  console.log('  sync          runs the sync process');
  console.log('  import        runs an import process');
}


// async function makeSchema() {
//   let argv = optimist
//     .usage('Usage: $0 make-schema -c <config file> [-s <schema filename>]')
//     .demand(  'c')
//     .alias(   'c', 'config')
//     .describe('c', 'name of the config file to use')
//     .alias(   'o', 'output')
//     .describe('o', 'name of the schema file to generate. defaults to schema.json')
//     .parse(process.argv.slice(3));
//
//   let configFilename = argv.config;
//   let filename = argv.output || 'schema.json';
//
//   try {
//     let config = await readJsonFile(configFilename, 'config');
//     await makeRetsConfig({
//       retsUrl: config.loginUrl,
//       retsUser: config.username,
//       retsPass: config.password
//     }, filename);
//     logger.strongGreen(`Created RETS schema file at ${filename}`);
//     logger.log(`  next steps:`);
//     logger.trace(`  1. in your schema file, update the wixCollection per resource/class`);
//     logger.trace(`     to specify into which site collection the data is synced`);
//     logger.trace(`  2. in your schema file, update the sync and syncImages resource/class`);
//     logger.trace(`     to specify what to sync`);
//     logger.trace(`  3. run wix-code-rests.js run`);
//   }
//   catch (e) {
//     logger.error(`Failed to create schema file ${filename} - ${e.message}`)
//   }
// }
//
// function makeSiteAPI(config) {
//   let {siteUrl, sandboxLive, batchCheckUpdateState, saveItemBatch, clearStale, getImageUploadUrl, secret} = config;
//   if (siteUrl) {
//     const functionsUrl = sandboxLive==='live'?'_functions':'_functions-dev';
//     if (siteUrl.charAt(siteUrl.length-1) !== '/')
//       siteUrl = siteUrl + '/';
//     const functionsBase = siteUrl + functionsUrl;
//     return {
//       "batchCheckUpdateState": functionsBase + '/batchCheckUpdateState',
//       "saveItemBatch": functionsBase + '/saveItemBatch',
//       "clearStale": functionsBase + '/clearStale',
//       "getImageUploadUrl": functionsBase + '/getImageUploadUrl',
//       secret
//     };
//   }
//   else
//     return {batchCheckUpdateState, saveItemBatch, clearStale, getImageUploadUrl, secret}
//
// }
//
// async function run() {
//   let argv = optimist
//     .usage('Usage: $0 run -c <config file> -s <schema filename>` [-r <resource id>] [-l <class name>] [-x] [-z]')
//     .demand(  'c')
//     .alias(   'c', 'config')
//     .describe('c', 'name of the config file to use')
//     .demand(  's')
//     .alias(   's', 'schema')
//     .describe('s', 'name of the schema file to use')
//     .alias(   'r', 'resource')
//     .describe('r', 'limit the run to the resource, or resources')
//     .alias(   'l', 'class')
//     .describe('l', 'limit the run to the class, or classes')
//     .alias(   'x', 'sync')
//     .describe('x', 'run only sync phase')
//     .alias(   'z', 'clear')
//     .describe('z', 'run only the clear phase')
//     .alias(   'a', 'audit')
//     .describe('a', 'save an audit log to the given filename')
//     .alias(   'f', 'force')
//     .describe('f', 'force refresh all resources in the DB - update resources even if no change detected')
//     .parse(process.argv.slice(3));
//
//   const defaultArray = (val) => val?(Array.isArray(val)?val:[val]):[];
//   let configFilename = argv.config;
//   let schemaFilename = argv.schema;
//   let audit = argv.audit;
//   let options = {
//     classes: defaultArray(argv.class),
//     resources: defaultArray(argv.resource),
//     sync: !argv.clear || argv.sync,
//     clear: !argv.sync || argv.clear,
//     force: argv.force
//   };
//
//   try {
//     let config = await readJsonFile(configFilename, 'config');
//     let schema = await readJsonFile(schemaFilename, 'schema');
//     if (audit) {
//       await logger.openAuditLog(audit);
//     }
//     try {
//       await syncMLS({
//         retsUrl: config.loginUrl,
//         retsUser: config.username,
//         retsPass: config.password
//       }, makeSiteAPI(config), schema, {...options, batchSize: config.batchSize});
//       await logger.auditLog('Completed RETS data sync');
//       logger.strongGreen(`Completed RETS data sync`);
//     }
//     finally {
//       if (audit) {
//         await logger.closeAuditLog();
//       }
//     }
//   }
//   catch (e) {
//     logger.error(`Failed to run MLS integration - ${e.message}`)
//   }
// }
//
// async function readJsonFile(filename, role) {
//   try {
//     return await JSON.parse(await readFile(filename))
//   }
//   catch (e) {
//     throw new Error(`Failed to read ${role} file ${filename}\n${e.message}`);
//   }
// }