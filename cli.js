#!/usr/bin/env node

/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';

import createLogger from 'bunyan-adaptor';
import { peowly } from 'peowly';

import { fetchEcosystemDependents } from './index.js';
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
      sort,
      'sort-dependents': sortDependents,
      'sort-downloads': sortDownloads,
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
      sort: {
        description: 'Sort by name',
        listGroup: 'Output options',
        type: 'boolean',
      },
      'sort-dependents': {
        description: 'Sort by dependents',
        listGroup: 'Output options',
        type: 'boolean',
      },
      'sort-downloads': {
        description: 'Sort by downloads',
        listGroup: 'Output options',
        type: 'boolean',
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
  const nonStreaming = sort || sortDependents || sortDownloads;

  if (maxPages !== undefined && Number.isNaN(maxPages)) {
    console.error('Expected --max-pages to be numeric');
    process.exit(1);
  }
  if (Number.isNaN(minDownloads)) {
    console.error('Expected --min-downloads to be numeric');
    process.exit(1);
  }

  logger?.debug({
    maxPages,
    minDownloads,
    pkgFields,
    skipPkg,
    name,
  }, 'Resolved options');

  if (!name) {
    showHelp();
    process.exit();
  }

  const generator = fetchEcosystemDependents(name, {
    logger,
    maxPages,
    minDownloadsLastMonth: minDownloads * 4,
    perPage: 100,
    skipPkg,
  });

  /** @type {Array<Omit<import('./index.js').EcosystemDependentsItem, 'pkg'> & { pkg?: Partial<import('./lib/npm-helpers.js').NormalizedPackageJson> | undefined }>} */
  const result = [];

  for await (const item of generator) {
    const output = item.pkg && pkgFields
      ? { ...item, pkg: pick(item.pkg, pkgFields) }
      : item;

    if (nonStreaming) {
      result.push(output);
    } else {
      console.log(JSON.stringify(output));
    }
  }

  if (sort) {
    result.sort((a, b) => a.name > b.name ? 1 : -1);
  }

  if (sortDependents) {
    result.sort((a, b) => {
      const aCount = a?.dependentCount || 0;
      const bCount = b?.dependentCount || 0;
      if (aCount < bCount) {
        return 1;
      } else if (aCount > bCount) {
        return -1;
      }
      return 0;
    });
  }

  if (sortDownloads) {
    result.sort((a, b) => a.downloads < b.downloads ? 1 : (a.downloads > b.downloads ? -1 : 0));
  }

  if (nonStreaming) {
    for (const output of result) {
      console.log(JSON.stringify(output));
    }
  }
} catch (err) {
  if (isErrorWithCode(err) && err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    console.error(err.message);
    process.exit(EXIT_CODE_INVALID_INPUT);
  }
  console.error(err);
  process.exit(EXIT_CODE_UNEXPECTED_ERROR);
}
