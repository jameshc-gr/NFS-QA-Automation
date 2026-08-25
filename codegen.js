#!/usr/bin/env node
// Bridge for WDIO codegen to load a TypeScript config (mobile/wdio.conf.ts)
// Ensures `npx wdio codegen` finds a config in the project root and avoids the
// interactive wizard asking to create one.

// Register ts-node to allow requiring .ts files
try {
  require('ts-node').register({ transpileOnly: true });
} catch (e) {
  // If ts-node isn't installed, print a helpful message and rethrow
  console.error('Please run `npm install` to install dev dependencies (ts-node).');
  throw e;
}

// Attempt to load the mobile TS config and export its `config` object
const path = require('path');
const cfgPath = path.join(process.cwd(), 'mobile', 'wdio.conf.ts');
const cfg = require(cfgPath);

// Ensure a named export `config` is available for WDIO
module.exports.config = cfg.config || cfg.default || cfg;
