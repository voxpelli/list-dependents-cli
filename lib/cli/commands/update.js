/* eslint-disable no-console */

import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import createLogger from 'bunyan-adaptor';
import ora from 'ora';
import { peowly } from 'peowly';

import { baseFlags } from '../flags/misc.js';
import { downloadFlags, validateDownloadFlags } from '../flags/download.js';
import { InputError, ndjsonParse } from '../utils.js';
import { fetchEcosystemDependents } from '../../../index.js';
import { pick } from '../../utils.js';

/** @type {import('peowly-commands').CliCommand} */
export const update = {
  description: 'Updates a list of module dependents',
  async run (argv, meta, { parentName }) {
    const name = parentName + ' update';

    const input = await setupCommand(name, update.description, argv, meta);

    await doTheWork(input);
  },
};

// Internal functions

/**
 * @param {string} name
 * @param {string} description
 * @param {string[]} args
 * @param {import('peowly-commands').CliMeta} meta
 * @returns {Promise<import('../cli-types.js').CommandContextUpdate>}
 */
async function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...downloadFlags,
    input: {
      description: 'Update data from the specified file',
      listGroup: 'Update options',
      'short': 'i',
      type: 'string',
    },
  });

  const {
    flags: {
      debug,
      input,
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
    usage: '-i <existing-file.ndjson> <name-of-npm-module>',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one name is supported');
  }

  if (!moduleName) {
    showHelp();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }

  /** @type {import('../cli-types.js').CommandContextUpdate} */
  const result = {
    debug,
    moduleName,
    input,
    ...validateDownloadFlags(remainingFlags),
  };

  return result;
}

/**
 * @param {import('../cli-types.js').CommandContextUpdate} context
 * @returns {Promise<void>}
 */
async function doTheWork (context) {
  const {
    debug,
    includePkg,
    input,
    maxAge,
    maxPages,
    minDownloads,
    moduleName,
    pkgFields,
  } = context;

  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const skipPkg = !(includePkg || pkgFields?.length);

  const readingSpinner = ora(`Reading existing data for ${moduleName}`).start();

  /** @type {Record<string, import('../cli-types.js').CliDependentsItem>} */
  const itemsByName = {};

  await pipeline(
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    input ? createReadStream(join(process.cwd(), input), 'utf8') : process.stdin,
    ndjsonParse,
    async source => {
      for await (const item of source) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        if ('name' in item && typeof item.name === 'string') {
          itemsByName[item.name] = /** @type {import('../cli-types.js').CliDependentsItem} */ (item);
        }
      }
    }
  );

  const remainingKeys = new Set(Object.keys(itemsByName));
  const originalSize = remainingKeys.size;

  readingSpinner.succeed(`Found ${originalSize} existing dependents`);

  const updateSpinner = ora(`Updating with new dependents for ${moduleName}`).start();

  const generator = fetchEcosystemDependents(moduleName, {
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

    itemsByName[item.name] = output;
    remainingKeys.delete(item.name);
  }

  const deleteSize = remainingKeys.size;

  for (const remainingKey of remainingKeys) {
    delete itemsByName[remainingKey];
  }

  const items = Object.values(itemsByName);
  for (const output of items) {
    console.log(JSON.stringify(output));
  }

  const updateSize = originalSize - deleteSize;
  const addSize = items.length - updateSize;

  updateSpinner.succeed(`Update successful. Added ${addSize}, updated ${updateSize} and removed ${deleteSize} items`);
}
