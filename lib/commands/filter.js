import { copyFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

import { oraPromise } from 'ora';
import { peowly } from 'peowly';
import { temporaryFileTask } from 'tempy';

import { baseFlags, sortFlags } from '../flags/misc.js';
import { InputError, arrayFromAsync, ndjsonOutput, ndjsonParse, omit, sortByKey } from '../utils.js';
import { inputFlags, outputFlags, validateFileFlags } from '../flags/file.js';
import { filterFlags, validateFilterFlags } from '../flags/filter.js';
import { includeByAge, includeByDownloads, includeByRepositoryPrefix, includeByTargetVersion } from '../filters.js';

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
          isSilent: !context.output || context.debug,
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
    ...omit(outputFlags, ['named']),
    ...filterFlags,
    ...sortFlags,
    'max-count': {
      description: 'Maximum amount of items to include',
      listGroup: 'Filter options',
      type: 'string',
    },
    'repository-prefix': {
      description: 'Required repository prefix',
      listGroup: 'Filter options',
      type: 'string',
    },
    'target-version': {
      description: 'Require that the target version is of this semantic version range',
      listGroup: 'Filter options',
      type: 'string',
    },
  });

  const {
    flags: {
      debug,
      'max-count': rawMaxCount,
      'repository-prefix': repositoryPrefix,
      sort,
      'sort-dependent': sortDependents,
      'sort-download': sortDownloads,
      'target-version': targetVersion,
      ...remainingFlags
    },
    input: [targetFile, ...otherInput],
    showHelp,
  } = peowly({
    args,
    description,
    examples: [
      '-i input-file.ndjson -o output-file.ndjson',
      '-i input-file.ndjson',
      'list.ndjson',
      { prefix: 'cat input-file.ndjson |', suffix: ' > output-file.ndjson' },
    ],
    name,
    options,
    pkg,
    usage: '<list.ndjson>',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one target file is supported');
  }

  const maxCount = rawMaxCount ? Number.parseInt(rawMaxCount) : undefined;

  if (maxCount !== undefined && Number.isNaN(maxCount)) {
    throw new InputError('Expected --max-count to be numeric');
  }

  /** @type {import('../cli-types.d.ts').CommandContextFilter} */
  const result = {
    debug,
    maxCount,
    repositoryPrefix,
    sort,
    sortDependents,
    sortDownloads,
    targetVersion,
    ...validateFileFlags({ ...remainingFlags, named: false }, targetFile),
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
    maxCount = Number.POSITIVE_INFINITY,
    minDownloads,
    modifyInPlace,
    output,
    repositoryPrefix,
    sort,
    sortDependents,
    sortDownloads,
    targetVersion,
  } = context;

  if (!input) {
    throw new InputError('No input given');
  }

  const streaming = !sort && !sortDependents && !sortDownloads;

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

        if (
          includeByAge(item, maxAge) &&
          // TODO: Ensure this check is for actual weekly downloads
          includeByDownloads(item, minDownloads) &&
          includeByRepositoryPrefix(item, repositoryPrefix) &&
          includeByTargetVersion(item, targetVersion)
        ) {
          included += 1;
          yield /** @type {import('../cli-types.d.ts').CliDependentsItem} */ (item);
        }

        spinner.text = `Processed ${count} items, included ${included} items, filtered ${count - included} items`;

        if (included > maxCount && streaming) {
          break;
        }
      }
    },
    async collection => {
      if (streaming) {
        await ndjsonOutput(collection, modifyInPlace ? tmpFile : output);
      } else {
        result = await arrayFromAsync(collection);
      }
    }
  );

  if (result) {
    if (sort) { result.sort(sortByKey('name')); }
    if (sortDependents) { result.sort(sortByKey('dependentCount', true)); }
    if (sortDownloads) { result.sort(sortByKey('downloads', true)); }

    await ndjsonOutput(result.slice(0, maxCount), output);
  } else if (modifyInPlace && output) {
    await copyFile(tmpFile, output);
  }
}
