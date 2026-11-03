'use strict';
const path = require('node:path');

if (Number(process.versions.node.split('.')[0]) < 22) {
  throw new Error('Solution Finder Lab requires Node.js 22 or newer. Use Node.js 22 or 24 LTS.');
}
const directory = path.resolve(__dirname, '..');
const { sfLabCatalog } = require(path.join(directory, 'package.json'));
if (!['internal165', 'original125', 'synthetic5'].includes(sfLabCatalog)) throw new Error('Unknown packaged scenario catalog.');
process.env.SF_LAB_CATALOG = sfLabCatalog;
process.env.SF_LAB_PORTABLE = sfLabCatalog === 'synthetic5' ? '1' : '0';
process.env.SF_LAB_DISTRIBUTION = sfLabCatalog === 'synthetic5' ? 'synthetic-5' :
  sfLabCatalog === 'internal165' ? 'internal-165' : 'internal-125';
require(path.join(directory, 'scripts/solution-finder/lab/server.js')).startLabServer();
