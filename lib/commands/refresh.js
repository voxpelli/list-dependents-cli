import { copyFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';

import { omit } from '@voxpelli/typed-utils';
import { bufferedAsyncMap } from 'buffered-async-iterable';
import createLogger from 'bunyan-adaptor';
import { createPackageFetchQueue } from 'list-dependents';
import { oraPromise } from 'ora';
import { peowly } from 'peowly';
import { temporaryFileTask } from 'tempy';

import { baseFlags } from '../flags/misc.js';
import { downloadFlags, validateDownloadFlags } from '../flags/download.js';
import { InputError, ResultError } from '../utils/errors.js';
import { formatItem } from '../utils/fields.js';
import { ndjsonOutput, ndjsonParse } from '../utils/ndjson.js';
import { inputFlags, outputFlags, validateFileFlags } from '../flags/file.js';

/** @type {import('peowly-commands').CliCommand} */
export const refresh = {
  description: 'Refreshes the data in a list of modules',
  async run (argv, meta, { parentName }) {
    const name = parentName + ' refresh';

    const context = await setupCommand(name, refresh.description, argv, meta);

    await (
      oraPromise(
        spinner => temporaryFileTask(tmpFile => processData(spinner, tmpFile, context)),
        {
          prefixText: 'Processing data',
          isSilent: !context.output || context.quiet,
        }
      )
        .catch(/** @param {unknown} cause */ cause => {
          throw new Error('Failed to process data', { cause });
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
 * @returns {Promise<import('../cli-types.d.ts').CommandContextRefresh>}
 */
async function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...inputFlags,
    ...outputFlags,
    ...omit(downloadFlags, ['max-pages']),
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
      quiet,
      ...remainingFlags
    },
    input,
    showHelp,
  } = peowly({
    args,
    description,
    examples: [
      { prefix: 'cat input-file.ndjson |', suffix: ' > output-file.ndjson' },
      '-i input-file.ndjson -o output-file.ndjson',
      '-i input-file.ndjson',
      '-n installed-check',
      'list.ndjson',
    ],
    name,
    options,
    pkg,
    usage: '[list.ndjson] [name-of-npm-module]',
  });

  let [targetFile, moduleName, ...otherInput] = input;

  if (otherInput.length > 0) {
    throw new InputError('Only one name is supported');
  }

  if (remainingFlags.named && !moduleName) {
    moduleName = targetFile;
    targetFile = undefined;
  }

  /** @type {import('../cli-types.d.ts').CommandContextRefresh} */
  const result = {
    check,
    debug,
    moduleName,
    quiet,
    ...validateDownloadFlags({ ...remainingFlags, 'max-pages': undefined }),
    ...validateFileFlags(remainingFlags, targetFile, moduleName),
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
 * @param {import('../cli-types.d.ts').CommandContextRefresh} context
 * @returns {Promise<void>}
 */
async function processData (spinner, tmpFile, context) {
  const {
    check,
    debug,
    downloadPrecision,
    includePkg,
    input,
    modifyInPlace,
    moduleName,
    output,
    pkgFields,
  } = context;

  if (!input) {
    throw new InputError('No input given');
  }

  // eslint-disable-next-line no-console
  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const skipPkg = !(includePkg || pkgFields?.length);
  const fetchPackage = createPackageFetchQueue({ logger });

  let count = 0;
  let updateSize = 0;
  let notFoundSize = 0;
  let removedSize = 0;

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

        yield {
          item,
          lookup: fetchPackage(item.name, {
            dependentOn: moduleName,
            skipPkg: skipPkg && 'latestVersion' in item
              // Do not skip package fetching if the version has changed, then we want dependentOn to check
              ? meta => meta.latestVersion === item.latestVersion
              : skipPkg,
          }),
        };
      }
    },
    async function * (collection) {
      yield * bufferedAsyncMap(collection, async function * ({ item, lookup }) {
        const newData = await lookup;

        const resolvedNewData = newData && formatItem(newData, { downloadPrecision, pkgFields });

        if (resolvedNewData && !('pkg' in resolvedNewData) && 'pkg' in item && item.pkg) {
          resolvedNewData.pkg = item.pkg;
        }

        count += 1;

        if (newData === false) {
          removedSize += 1;
        } else if (!newData) {
          notFoundSize += 1;
        } else if (!isDeepStrictEqual(item, resolvedNewData)) {
          updateSize += 1;
        }

        spinner.text = `Up to date ${count - updateSize - notFoundSize - removedSize}, updated ${updateSize}${removedSize ? `, removed ${removedSize}` : ''}${notFoundSize ? `, failed to update ${notFoundSize}` : ''}`;

        if (newData !== false) {
          yield resolvedNewData || item;
        }
      }, { ordered: true });
    },
    async collection => {
      if (!check) {
        await ndjsonOutput(collection, modifyInPlace ? tmpFile : output);
      }
    }
  );

  if (!updateSize && !notFoundSize && !removedSize) {
    spinner.text = 'All up to date!';
  } else if (check) {
    throw new ResultError('Outdated data');
  } else if (modifyInPlace && output && (updateSize > 0 || removedSize > 0)) {
    await copyFile(tmpFile, output);
  }
}
