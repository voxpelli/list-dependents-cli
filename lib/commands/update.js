import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';

import createLogger from 'bunyan-adaptor';
import { fetchEcosystemDependents } from 'list-dependents';
import { oraPromise } from 'ora';
import { peowly } from 'peowly';

import { baseFlags } from '../flags/misc.js';
import { downloadFlags, validateDownloadFlags } from '../flags/download.js';
import { InputError, ResultError, ndjsonOutput, ndjsonParse, resolvePkgFields } from '../utils.js';
import { inputFlags, outputFlags, validateFileFlags } from '../flags/file.js';

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
    ...inputFlags,
    ...outputFlags,
    ...downloadFlags,
    check: {
      description: 'Check if data is outdated',
      listGroup: 'Update options',
      type: 'boolean',
    },
  });

  const {
    flags: {
      check,
      debug,
      ...remainingFlags
    },
    input: [moduleName, targetFile, ...otherInput],
    showHelp,
  } = peowly({
    args,
    description,
    examples: [
      '-i foo.ndjson installed-check',
      '-o foo.ndjson installed-check',
      'installed-check foo.ndjson',
      '--check installed-check foo.ndjson',
    ],
    name,
    options,
    pkg,
    usage: '<name-of-npm-module> <target-file.ndjson>',
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
    check,
    debug,
    moduleName,
    ...validateDownloadFlags(remainingFlags),
    ...validateFileFlags(remainingFlags, targetFile, moduleName),
  };

  return result;
}

/** @typedef {Record<string, import('../cli-types.d.ts').CliDependentsItem>} CliDependentsCollection */

/**
 * @param {import('../cli-types.d.ts').CommandContextUpdate} context
 * @returns {Promise<void>}
 */
async function doTheWork (context) {
  const {
    check,
    input,
    moduleName,
  } = context;

  const itemsByName = await (
    oraPromise(
      spinner => readData(spinner, input),
      { prefixText: `Reading existing dependents data for ${moduleName}` }
    )
      .catch(err => {
        throw new InputError('Failed to read existing data', err instanceof Error ? err.message : undefined);
      })
  );

  await oraPromise(
    spinner => updateData(spinner, itemsByName, context),
    { prefixText: `${check ? 'Checking' : 'Updating'} dependents data for ${moduleName}` }
  );
}

/**
 * @param {import('ora').Ora} spinner
 * @param {string|undefined} input
 * @returns {Promise<CliDependentsCollection>}
 */
async function readData (spinner, input) {
  /** @type {CliDependentsCollection} */
  const itemsByName = {};
  let count = 0;

  const source = input
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    ? createReadStream(join(process.cwd(), input), 'utf8')
    : (process.stdin.isTTY ? undefined : process.stdin);

  if (!source) {
    throw new InputError('Neither --input nor stdin given');
  }

  await pipeline(
    source,
    ndjsonParse,
    async source => {
      for await (const item of source) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        if ('name' in item && typeof item.name === 'string') {
          count += 1;
          spinner.text = `Found ${count} existing dependents`;
          itemsByName[item.name] = /** @type {import('../cli-types.d.ts').CliDependentsItem} */ (item);
        }
      }
    }
  );

  if (Object.keys(itemsByName).length === 0) {
    throw new InputError(input ? `Found no data in: ${input}` : 'Found no data in stdin');
  }

  return itemsByName;
}

/**
 * @param {import('ora').Ora} spinner
 * @param {CliDependentsCollection} itemsByName
 * @param {import('../cli-types.d.ts').CommandContextUpdate} context
 */
async function updateData (spinner, itemsByName, context) {
  const {
    check,
    debug,
    includePkg,
    maxAge,
    maxPages,
    minDownloads,
    moduleName,
    output,
    pkgFields,
  } = context;

  // eslint-disable-next-line no-console
  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const skipPkg = !(includePkg || pkgFields?.length);
  const remainingKeys = new Set(Object.keys(itemsByName));

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

    spinner.text = check
      ? `Missing ${addSize}, outdated ${updateSize}, up to date ${unchangedSize}`
      : `Added ${addSize}, updated ${updateSize}, unchanged ${unchangedSize}`;
  }

  const deleteSize = remainingKeys.size;

  for (const remainingKey of remainingKeys) {
    delete itemsByName[remainingKey];
  }

  if (!check) {
    await ndjsonOutput(Object.values(itemsByName), output);
  }

  if (addSize || updateSize || deleteSize) {
    spinner.text += `, ${check ? 'extraneous' : 'removed'} ${deleteSize}`;

    if (check) {
      throw new ResultError('Outdated data');
    }
  } else {
    spinner.text = 'All up to date!';
  }
}
