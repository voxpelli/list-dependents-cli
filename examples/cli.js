/* eslint-disable unicorn/no-process-exit */
/* eslint-disable no-console */

import { createLogger } from 'bunyan-adaptor';
import { fetchEcosystemDependents, fetchNpmDependents } from '../index.js';

const name = process.argv[2];
const ecosystem = process.argv[3] === 'ecosystem';
const minDownloads = process.argv[4] ? Number.parseInt(process.argv[4]) : 100;
const maxPages = process.argv[5] ? Number.parseInt(process.argv[5]) : undefined;

if (!name) {
  console.error('Expected a package name');
  process.exit(1);
}

const options = /** @satisfies {import('../index.js').DependentsOptions} */ ({
  logger: createLogger(),
  maxPages,
});

const result = ecosystem
  ? fetchEcosystemDependents(name, { ...options, minDownloadsLastMonth: minDownloads })
  : fetchNpmDependents(name, { ...options, minDownloadsLastWeek: minDownloads });

for await (const { downloads, name, pkg, ...rest } of result) {
  console.log(downloads, name, rest, pkg?.description);
}
