// CJS wrapper: runs the ESM replication test under any node.
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const target = path.join(__dirname, 'test-replicate.mjs');
import(pathToFileURL(target).href).catch((e) => { console.error(e); process.exit(1); });
