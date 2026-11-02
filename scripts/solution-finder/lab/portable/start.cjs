'use strict';
const path = require('node:path');

if (Number(process.versions.node.split('.')[0]) < 22) {
  throw new Error('Solution Finder Lab requires Node.js 22 or newer. Use Node.js 22 or 24 LTS.');
}
const directory = path.resolve(__dirname, '..');
process.env.SF_LAB_PORTABLE = '1';
require(path.join(directory, 'scripts/solution-finder/lab/server.js')).startLabServer();
