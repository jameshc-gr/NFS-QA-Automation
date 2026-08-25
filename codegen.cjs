#!/usr/bin/env node
// CommonJS bridge for WDIO to load the TypeScript mobile config.
try {
  require('ts-node').register({ transpileOnly: true });
} catch (e) {
  console.error('Please run `npm install` to install dev dependencies (ts-node).');
  throw e;
}

const path = require('path');
const cfgPath = path.join(process.cwd(), 'mobile', 'wdio.conf.ts');
const cfg = require(cfgPath);

// Ensure named export `config` for WDIO
module.exports.config = cfg.config || cfg.default || cfg;
