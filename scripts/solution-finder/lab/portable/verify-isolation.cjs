'use strict';
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..') + path.sep;
const resolve = Module._resolveFilename;
Module._resolveFilename = function (...args) {
  const file = resolve.apply(this, args);
  if (path.isAbsolute(file) && !file.startsWith(root)) {
    throw new Error(`Standalone verification rejected a module outside the extracted package: ${file}`);
  }
  return file;
};
