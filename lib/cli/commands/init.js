/* eslint-disable no-console */
import createLogger from 'bunyan-adaptor';
import ora from 'ora';
import { peowly } from 'peowly';

import { baseFlags, sortFlags } from '../flags/misc.js';
import { downloadFlags, validateDownloadFlags } from '../flags/download.js';
import { InputError, sortByKey } from '../utils.js';
import { fetchEcosystemDependents } from '../../../index.js';
import { pick } from '../../utils.js';

/** @type {import('peowly-commands').CliCommand} */
export const init = {
  description: 'Initializes a list of module dependents',
  async run (argv, meta, { parentName }) {
    const name = parentName + ' init';

    const input = setupCommand(name, init.description, argv, meta);

    await doTheWork(input);
  },
};

// Internal functions

/**
 * @param {string} name
 * @param {string} description
 * @param {string[]} args
 * @param {import('peowly-commands').CliMeta} meta
 * @returns {import('../cli-types.js').CommandContextInit}
 */
function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...downloadFlags,
    ...sortFlags,
  });

  const {
    flags: {
      debug,
      sort,
      'sort-dependent': sortDependents,
      'sort-download': sortDownloads,
      ...remainingFlags
    },
    input: [moduleName, ...otherInput],
    showHelp,
  } = peowly({
    args,
    description,
    name,
    options,
    pkg,
    usage: '<name-of-npm-module>',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one name is supported');
  }

  if (!moduleName) {
    showHelp();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }

  /** @type {import('../cli-types.js').CommandContextInit} */
  const result = {
    debug,
    moduleName,
    sort,
    sortDependents,
    sortDownloads,
    ...validateDownloadFlags(remainingFlags),
  };

  return result;
}

/**
 * @param {import('../cli-types.js').CommandContextInit} context
 * @returns {Promise<void>}
 */
async function doTheWork (context) {
  const {
    debug,
    includePkg,
    maxAge,
    maxPages,
    minDownloads,
    moduleName,
    pkgFields,
    sort,
    sortDependents,
    sortDownloads,
  } = context;

  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const skipPkg = !(includePkg || pkgFields?.length);
  const nonStreaming = sort || sortDependents || sortDownloads;

  // Using "ora" is of course optional
  const spinner = ora(`Looking up dependents for ${moduleName}`).start();

  const generator = fetchEcosystemDependents(moduleName, {
    logger,
    maxAge,
    maxPages,
    minDownloadsLastMonth: minDownloads * 4,
    perPage: 100,
    skipPkg,
  });

  /** @type {import('../cli-types.js').CliDependentsItem[]} */
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

  if (sort) { result.sort(sortByKey('name')); }
  if (sortDependents) { result.sort(sortByKey('dependentCount', true)); }
  if (sortDownloads) { result.sort(sortByKey('downloads', true)); }

  if (nonStreaming) {
    for (const output of result) {
      console.log(JSON.stringify(output));
    }
  }

  spinner.succeed('All good!');
}
