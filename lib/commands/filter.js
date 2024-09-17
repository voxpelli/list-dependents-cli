import { copyFile } from 'node:fs/promises';
import { stdout } from 'node:process';
import { pipeline } from 'node:stream/promises';

import { omit } from '@voxpelli/typed-utils';
import { oraPromise } from 'ora';
import { peowly } from 'peowly';
import { temporaryFileTask } from 'tempy';

import { baseFlags, formatFlags, sortFlags } from '../flags/misc.js';
import { ndjsonOutput, ndjsonParse } from '../utils/ndjson.js';
import { InputError } from '../utils/errors.js';
import { arrayFromAsync, sortByKey } from '../utils/misc.js';
import { inputFlags, outputFlags, validateFileFlags } from '../flags/file.js';
import { filterFlags, validateFilterFlags } from '../flags/filter.js';
import { includeByAge, includeByDownloads, includeByRepositoryPrefix, includeByTargetVersion } from '../filters.js';
import { formatList } from '../utils/format.js';

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
          isSilent: !context.output || context.quiet || context.markdown || context.prettyPrint,
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
 * @returns {Promise<import('../cli-types.d.ts').CommandContextFilter>}
 */
async function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...inputFlags,
    ...omit(outputFlags, ['named']),
    ...filterFlags,
    ...formatFlags,
    ...sortFlags,
    exclude: {
      description: 'The name or repository url of a module to exclude (repeatable)',
      listGroup: 'Filter options',
      type: 'string',
      multiple: true,
    },
    include: {
      description: 'The name or repository url of a module to always include',
      listGroup: 'Filter options',
      type: 'string',
      multiple: true,
    },
    'max-count': {
      description: 'Maximum amount of items to include',
      listGroup: 'Filter options',
      type: 'string',
    },
    'pretty-print': {
      description: 'Pretty print the output',
      listGroup: 'Format options',
      type: 'boolean',
      'default': false,
    },
    'repository-prefix': {
      description: 'Required repository prefix',
      listGroup: 'Filter options',
      type: 'string',
      multiple: true,
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
      exclude,
      field: pkgFields,
      include,
      markdown,
      'max-count': rawMaxCount,
      'no-links': skipLinks,
      'pretty-print': prettyPrint,
      quiet,
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
    usage: '[list.ndjson]',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one target file is supported');
  }

  const maxCount = rawMaxCount ? Number.parseInt(rawMaxCount) : undefined;

  if (maxCount !== undefined && Number.isNaN(maxCount)) {
    throw new InputError('Expected --max-count to be numeric');
  }

  if (!markdown && !prettyPrint && (pkgFields || skipLinks)) {
    throw new InputError('--field / --no-links are only possible to combine with --markdown / --pretty-print');
  }

  /** @type {import('../cli-types.d.ts').CommandContextFilter} */
  const result = {
    debug,
    exclude,
    include,
    markdown,
    maxCount,
    pkgFields,
    prettyPrint,
    quiet,
    repositoryPrefix,
    skipLinks,
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
    exclude = [],
    include,
    input,
    markdown,
    maxAge,
    maxCount = Number.POSITIVE_INFINITY,
    minDownloads,
    modifyInPlace,
    output,
    pkgFields,
    prettyPrint,
    repositoryPrefix,
    skipLinks,
    sort,
    sortDependents,
    sortDownloads,
    targetVersion,
  } = context;

  if (!input) {
    throw new InputError('No input given');
  }

  const streaming = !sort && !sortDependents && !sortDownloads && !markdown && !prettyPrint && include;

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
        if (!('repositoryUrl' in item) || typeof item.repositoryUrl !== 'string') {
          continue;
        }

        count += 1;

        if (
          !exclude.includes(item.name) &&
          !exclude.includes(item.repositoryUrl) &&
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

    let finalResult = result;

    if (result.length > maxCount) {
      finalResult = result.slice(0, maxCount);

      if (include) {
        /** @type {Set<string>} */
        const included = new Set();

        for (const { name, repositoryUrl } of finalResult) {
          if (include.includes(name)) {
            included.add(name);
          } else if (repositoryUrl && include.includes(repositoryUrl)) {
            included.add(repositoryUrl);
          }
        }

        if (included.size < include.length) {
          const remaining = new Set(include.filter(value => !included.has(value)));

          const additional = result.slice(maxCount).filter(
            ({ name, repositoryUrl }) =>
              remaining.has(name) || (repositoryUrl && remaining.has(repositoryUrl))
          );

          let nextToInclude = additional.pop();

          for (let i = finalResult.length - 1; i >= 0; i--) {
            if (!nextToInclude) {
              break;
            }

            const { name } = finalResult[i] || {};

            if (name && !included.has(name)) {
              finalResult[i] = nextToInclude;
              nextToInclude = additional.pop();
            }
          }

          // If there are some remaining for some reason, then include them despite exceding the maxCount
          if (additional.length || nextToInclude) {
            finalResult = [
              ...finalResult,
              ...additional,
              ...nextToInclude ? [nextToInclude] : [],
            ];
          }

          if (sort) { finalResult.sort(sortByKey('name')); }
          if (sortDependents) { finalResult.sort(sortByKey('dependentCount', true)); }
          if (sortDownloads) { finalResult.sort(sortByKey('downloads', true)); }
        }
      }
    }

    // eslint-disable-next-line unicorn/prefer-ternary
    if (markdown || prettyPrint) {
      await pipeline(
        formatList(finalResult, {
          markdown,
          pkgFields,
          skipLinks,
        }),
        stdout
      );
    } else {
      await ndjsonOutput(finalResult, output);
    }
  } else if (modifyInPlace && output) {
    await copyFile(tmpFile, output);
  }
}
