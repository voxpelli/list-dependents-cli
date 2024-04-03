#!/usr/bin/env node
/* eslint-disable no-console */

import { fetchEcosystemDependents } from './lib/ecosystems.js';
import { fetchNpmDependents } from './lib/npm.js';

const name = process.argv[2];
const ecosystem = process.argv[3] === 'ecosystem';
const minDownloads = process.argv[4] ? Number.parseInt(process.argv[4]) : 100;
const maxPages = process.argv[5] ? Number.parseInt(process.argv[5]) : undefined;

if (!name) {
  console.error('Expected a package name');
  process.exit(1);
}

const result = ecosystem
  ? fetchEcosystemDependents(name, { minDownloadsLastMonth: minDownloads, maxPages })
  : fetchNpmDependents(name, { minDownloadsLastWeek: minDownloads, maxPages });

for await (const { downloads, name, pkg, ...rest } of result) {
  console.log(downloads, name, rest, pkg.description);
}
