#!/usr/bin/env node
/* eslint-disable no-console */

import { fetchEcosystemDependentPackages } from './lib/ecosystems.js';
import { fetchNpmDependentPackages } from './lib/npm.js';

const name = process.argv[2];
const ecosystem = process.argv[3] === 'ecosystem';
const minDownloads = process.argv[4] ? Number.parseInt(process.argv[4]) : 100;
const maxPages = process.argv[5] ? Number.parseInt(process.argv[5]) : undefined;

if (!name) {
  console.error('Expected a package name');
  process.exit(1);
}

const result = ecosystem
  ? fetchEcosystemDependentPackages(name, { minDownloadsLastMonth: minDownloads, maxPages })
  : fetchNpmDependentPackages(name, { minDownloadsLastWee: minDownloads, maxPages });

for await (const { dependentCount, downloads, name, pkg, stargazers } of result) {
  console.log(downloads, name, dependentCount, stargazers, pkg.description);
}
