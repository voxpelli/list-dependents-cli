#!/usr/bin/env node

/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';

import createLogger from 'bunyan-adaptor';
import { peowly } from 'peowly';

import { fetchEcosystemDependents, fetchNpmDependents } from './index.js';
import { isErrorWithCode, pick } from './lib/utils.js';

// const EXIT_CODE_ERROR_RESULT = 1;
const EXIT_CODE_INVALID_INPUT = 2;
const EXIT_CODE_UNEXPECTED_ERROR = 4;

// eslint-disable-next-line security/detect-non-literal-fs-filename
const pkg = JSON.parse(await readFile(new URL('package.json', import.meta.url), 'utf8'));

try {
  const {
    flags: {
      debug,
      field: pkgFields,
      'include-pkg': includePkg,
      'max-pages': rawMaxPages,
      'min-downloads': rawMinDownloads,
      npm: useNpm,
    },
    input: [name, ...otherInput],
    showHelp,
  } = peowly({
    options: {
      debug: {
        description: 'Use to output debug data',
        type: 'boolean',
      },
      'field': {
        description: 'Narrow down the package.json fields to include',
        listGroup: 'Download options',
        multiple: true,
        type: 'string',
      },
      'include-pkg': {
        description: 'Include module\'s package.json file in result',
        listGroup: 'Download options',
        type: 'boolean',
      },
      npm: {
        description: 'Use npm crawling (instead of ecosyste.ms) to find dependents',
        listGroup: 'Download options',
        type: 'boolean',
      },
      'min-downloads': {
        'default': '100',
        description: 'Min amount of weekly downloads needed to be included',
        listGroup: 'Download options',
        type: 'string',
      },
      'max-pages': {
        description: 'Max amount of pages to iterate through',
        listGroup: 'Download options',
        type: 'string',
      },
    },
    pkg,
    usage: '<name-of-npm-module>',
  });

  if (otherInput.length > 0) {
    console.error('Only one name is supported');
    process.exit(1);
  }

  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const maxPages = rawMaxPages ? Number.parseInt(rawMaxPages) : undefined;
  const minDownloads = Number.parseInt(rawMinDownloads);
  const skipPkg = !(includePkg || pkgFields?.length);

  if (maxPages !== undefined && Number.isNaN(maxPages)) {
    console.error('Expected --max-pages to be numeric');
    process.exit(1);
  }
  if (Number.isNaN(minDownloads)) {
    console.error('Expected --min-downloads to be numeric');
    process.exit(1);
  }

  const options = /** @satisfies {import('./index.js').DependentsOptions} */ ({
    logger,
    maxPages,
    skipPkg,
  });

  logger?.debug({
    ...pick(options, ['maxPages', 'skipPkg']),
    pkgFields,
    minDownloads,
    name,
  }, 'Resolved options');

  if (!name) {
    showHelp();
    process.exit();
  }

  const result = useNpm
    ? fetchNpmDependents(name, { ...options, minDownloadsLastWeek: minDownloads })
    : fetchEcosystemDependents(name, { ...options, minDownloadsLastMonth: minDownloads * 4 });

  for await (const item of result) {
    const output = item.pkg && pkgFields
      ? { ...item, pkg: pick(item.pkg, pkgFields) }
      : item;

    console.log(JSON.stringify(output));
  }
} catch (err) {
  if (isErrorWithCode(err) && err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    console.error(err.message);
    process.exit(EXIT_CODE_INVALID_INPUT);
  }
  console.error(err);
  process.exit(EXIT_CODE_UNEXPECTED_ERROR);
}
