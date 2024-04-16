#!/usr/bin/env node

/* eslint-disable no-console */

import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import createLogger from 'bunyan-adaptor';
import { peowly } from 'peowly';

import { fetchEcosystemDependents } from './index.js';
import { isErrorWithCode, ndjsonParse, pick, sortByKey } from './lib/utils.js';

/** @typedef {Omit<Partial<import('./index.js').EcosystemDependentsItem>, 'pkg' | 'name'> & { name: string, pkg?: Partial<import('./lib/npm-helpers.js').NormalizedPackageJson> | undefined }} CliDependentsItem */

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
      'max-age': rawMaxAge,
      'max-pages': rawMaxPages,
      'min-downloads': rawMinDownloads,
      sort,
      'sort-dependent': sortDependents,
      'sort-download': sortDownloads,
      update,
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
      'max-age': {
        description: 'Max age in days of latest release',
        listGroup: 'Download options',
        type: 'string',
      },
      'max-pages': {
        description: 'Max amount of pages to iterate through',
        listGroup: 'Download options',
        type: 'string',
      },
      'min-downloads': {
        'default': '100',
        description: 'Min amount of weekly downloads needed to be included',
        listGroup: 'Download options',
        type: 'string',
      },
      sort: {
        description: 'Sort by name',
        listGroup: 'Output options',
        type: 'boolean',
      },
      'sort-dependent': {
        description: 'Sort by dependents',
        listGroup: 'Output options',
        type: 'boolean',
      },
      'sort-download': {
        description: 'Sort by downloads',
        listGroup: 'Output options',
        type: 'boolean',
      },
      update: {
        description: 'Update the specified file',
        listGroup: 'Output options',
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
  const maxAge = rawMaxAge ? Number.parseInt(rawMaxAge) : undefined;
  const maxPages = rawMaxPages ? Number.parseInt(rawMaxPages) : undefined;
  const minDownloads = Number.parseInt(rawMinDownloads);
  const skipPkg = !(includePkg || pkgFields?.length);
  const nonStreaming = sort || sortDependents || sortDownloads || update;

  if (update && (sort || sortDependents || sortDownloads)) {
    console.error('Can not update and sort at once');
    process.exit(1);
  }
  if (maxAge !== undefined && Number.isNaN(maxAge)) {
    console.error('Expected --max-age to be numeric');
    process.exit(1);
  }
  if (maxPages !== undefined && Number.isNaN(maxPages)) {
    console.error('Expected --max-pages to be numeric');
    process.exit(1);
  }
  if (Number.isNaN(minDownloads)) {
    console.error('Expected --min-downloads to be numeric');
    process.exit(1);
  }

  /** @type {Record<string, CliDependentsItem>} */
  const itemsByName = {};

  if (update) {
    await pipeline(
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      createReadStream(join(process.cwd(), update), 'utf8'),
      ndjsonParse,
      async source => {
        for await (const item of source) {
          if (!item || typeof item !== 'object') {
            continue;
          }
          if ('name' in item && typeof item.name === 'string') {
            itemsByName[item.name] = /** @type {CliDependentsItem} */ (item);
          }
        }
      }
    );
  }

  const remainingKeys = new Set(Object.keys(itemsByName));

  logger?.debug({
    maxAge,
    maxPages,
    minDownloads,
    name,
    pkgFields,
    remainingKeys: remainingKeys.size,
    skipPkg,
  }, 'Resolved options');

  if (!name) {
    showHelp();
    process.exit();
  }

  const generator = fetchEcosystemDependents(name, {
    logger,
    maxAge,
    maxPages,
    minDownloadsLastMonth: minDownloads * 4,
    perPage: 100,
    skipPkg,
  });

  for await (const item of generator) {
    const output = item.pkg && pkgFields
      ? { ...item, pkg: pick(item.pkg, pkgFields) }
      : item;

    if (nonStreaming) {
      itemsByName[item.name] = output;
      remainingKeys.delete(item.name);
    } else {
      console.log(JSON.stringify(output));
    }
  }

  for (const remainingKey of remainingKeys) {
    delete itemsByName[remainingKey];
  }

  const result = Object.values(itemsByName);

  if (sort) { result.sort(sortByKey('name')); }
  if (sortDependents) { result.sort(sortByKey('dependentCount', true)); }
  if (sortDownloads) { result.sort(sortByKey('downloads', true)); }

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
