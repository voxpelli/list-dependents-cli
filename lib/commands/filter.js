import { copyFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

import { oraPromise } from 'ora';
import { peowly } from 'peowly';
import { temporaryFileTask } from 'tempy';

import { baseFlags, sortFlags } from '../flags/misc.js';
import { InputError, arrayFromAsync, ndjsonOutput, ndjsonParse, sortByKey } from '../utils.js';
import { inputFlags, outputFlags, validateFileFlags } from '../flags/file.js';
import { filterFlags, validateFilterFlags } from '../flags/filter.js';
import { includeByAge, includeByDownloads } from '../filters.js';

/** @type {import('peowly-commands').CliCommand} */
export const filter = {
  description: 'Filters a list of dependents',
  async run (argv, meta, { parentName }) {
    const name = parentName + ' filter';

    const context = await setupCommand(name, filter.description, argv, meta);

    await (
      oraPromise(
        spinner => temporaryFileTask(tmpFile => processData(spinner, tmpFile, context)),
        {
          prefixText: 'Processing data',
          isSilent: !context.output,
        }
      )
        .catch(/** @param {unknown} err */ err => {
          throw new InputError('Failed to process data', err instanceof Error ? err.message : undefined);
        })
    );
  },
};

// Internal functions

/**
 * @param {string} name
 * @param {string} description
 * @param {string[]} args
 * @param {import('peowly-commands').CliMeta} meta
 * @returns {Promise<import('../cli-types.d.ts').CommandContextFilter>}
 */
async function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...inputFlags,
    ...outputFlags,
    ...filterFlags,
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
    input: [...otherInput],
    showHelp,
  } = peowly({
    args,
    description,
    name,
    options,
    pkg,
    usage: '-i input-file.ndjson -o output-file.ndjson',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one name is supported');
  }

  /** @type {import('../cli-types.d.ts').CommandContextFilter} */
  const result = {
    debug,
    sort,
    sortDependents,
    sortDownloads,
    ...validateFileFlags(remainingFlags),
    ...validateFilterFlags(remainingFlags),
  };

  if (!result.input) {
    showHelp();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }

  return result;
}

/**
 * @param {import('ora').Ora} spinner
 * @param {string} tmpFile
 * @param {import('../cli-types.d.ts').CommandContextFilter} context
 * @returns {Promise<void>}
 */
async function processData (spinner, tmpFile, context) {
  const {
    input,
    maxAge,
    minDownloads,
    modifyInPlace,
    output,
    sort,
    sortDependents,
    sortDownloads,
  } = context;

  if (!input) {
    throw new InputError('No input given');
  }

  const nonStreaming = sort || sortDependents || sortDownloads;

  /** @type {import('../cli-types.d.ts').CliDependentsItem[]|undefined} */
  let result;
  let count = 0;
  let included = 0;

  await pipeline(
    input,
    ndjsonParse,
    async function * (collection) {
      for await (const item of collection) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        if (!('name' in item) || typeof item.name !== 'string') {
          continue;
        }

        count += 1;

        // TODO: Ensure this check is for actual weekly downloads
        if (includeByAge(item, maxAge) && includeByDownloads(item, minDownloads)) {
          included += 1;
          yield /** @type {import('../cli-types.d.ts').CliDependentsItem} */ (item);
        }

        spinner.text = `Processed ${count} items, included ${included} items, filtered ${count - included} items`;
      }
    },
    async collection => {
      if (nonStreaming) {
        result = await arrayFromAsync(collection);
      } else {
        await ndjsonOutput(collection, modifyInPlace ? tmpFile : output);
      }
    }
  );

  if (result) {
    if (sort) { result.sort(sortByKey('name')); }
    if (sortDependents) { result.sort(sortByKey('dependentCount', true)); }
    if (sortDownloads) { result.sort(sortByKey('downloads', true)); }

    await ndjsonOutput(result, output);
  } else if (modifyInPlace && output) {
    await copyFile(tmpFile, output);
  }
}
