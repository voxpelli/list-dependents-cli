/* eslint-disable no-console */

import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';

import createLogger from 'bunyan-adaptor';
import ora from 'ora';
import { peowly } from 'peowly';

import { baseFlags } from '../flags/misc.js';
import { downloadFlags, validateDownloadFlags } from '../flags/download.js';
import { InputError, ndjsonOutput, ndjsonParse, resolvePkgFields } from '../utils.js';
import { fetchEcosystemDependents } from '../../../index.js';

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
 * @returns {Promise<import('../cli-types.d.ts').CommandContextUpdate>}
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
      output,
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

  /** @type {import('../cli-types.d.ts').CommandContextUpdate} */
  const result = {
    debug,
    moduleName,
    input,
    output,
    ...validateDownloadFlags(remainingFlags),
  };

  return result;
}

/**
 * @param {import('../cli-types.d.ts').CommandContextUpdate} context
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
    output,
    pkgFields,
  } = context;

  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const skipPkg = !(includePkg || pkgFields?.length);
  const isSilent = !output;

  const readingSpinner = ora({
    prefixText: `Reading existing data for ${moduleName}`,
    isSilent,
  }).start();

  /** @type {Record<string, import('../cli-types.d.ts').CliDependentsItem>} */
  const itemsByName = {};
  let count = 0;

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
          count += 1;
          readingSpinner.text = `${count} existing dependents`;
          itemsByName[item.name] = /** @type {import('../cli-types.d.ts').CliDependentsItem} */ (item);
        }
      }
    }
  );

  readingSpinner.succeed();

  const remainingKeys = new Set(Object.keys(itemsByName));

  const updateSpinner = ora({
    prefixText: `Updating dependents for ${moduleName}`,
    isSilent,
  }).start();

  const baseGenerator = fetchEcosystemDependents(moduleName, {
    logger,
    maxAge,
    maxPages,
    minDownloadsLastMonth: minDownloads * 4,
    perPage: 100,
    skipPkg,
  });

  const generator = pkgFields
    ? resolvePkgFields(baseGenerator, pkgFields)
    : baseGenerator;

  let addSize = 0;
  let updateSize = 0;
  let unchangedSize = 0;

  for await (const item of generator) {
    remainingKeys.delete(item.name);

    if (!itemsByName[item.name]) {
      addSize += 1;
      itemsByName[item.name] = item;
    } else if (!isDeepStrictEqual(itemsByName[item.name], item)) {
      updateSize += 1;
      itemsByName[item.name] = item;
    } else {
      unchangedSize += 1;
    }

    updateSpinner.text = `Added ${addSize}, updated ${updateSize}, unchanged ${unchangedSize}`;
  }

  const deleteSize = remainingKeys.size;

  for (const remainingKey of remainingKeys) {
    delete itemsByName[remainingKey];
  }

  await ndjsonOutput(Object.values(itemsByName), output);

  if (addSize || updateSize || deleteSize) {
    updateSpinner.text += `, removed ${deleteSize}`;
  }

  updateSpinner.succeed();
}
