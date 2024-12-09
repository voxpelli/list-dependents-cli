import { isDeepStrictEqual } from 'node:util';

import { looksLikeAnErrnoException } from '@voxpelli/typed-utils';
import createLogger from 'bunyan-adaptor';
import { fetchEcosystemDependents } from 'list-dependents';
import { oraPromise } from 'ora';
import { peowly } from 'peowly';

import { baseFlags } from '../flags/misc.js';
import { downloadFlags, validateDownloadFlags } from '../flags/download.js';
import { InputError, ResultError } from '../utils/errors.js';
import { formatItems } from '../utils/fields.js';
import { ndjsonOutput } from '../utils/ndjson.js';
import { inputFlags, outputFlags, validateFileFlags } from '../flags/file.js';
import { filterFlags, validateFilterFlags } from '../flags/filter.js';
import { formatSummary } from '../utils/summary.js';
import { readDependentsCollection } from '../utils/read.js';

/** @type {import('peowly-commands').CliCommand} */
export const list = {
  description: 'Look up list of module dependents',
  async run (argv, meta, { parentName }) {
    const name = parentName + ' list';

    const context = await setupCommand(name, list.description, argv, meta);

    const {
      check,
      explicitInput,
      input,
      moduleName,
      output,
      quiet,
    } = context;

    if (check && !input) {
      throw new InputError('--check requires an input');
    }

    const itemsByName = input && await (
      oraPromise(
        spinner => readDependentsCollection(input, spinner),
        {
          prefixText: `Reading existing dependents data for ${moduleName}`,
          isSilent: !output || quiet,
        }
      )
        .catch(
          /**
           * @param {unknown} err
           * @returns {undefined}
           */
          err => {
            if (looksLikeAnErrnoException(err) && err.code === 'ENOENT') {
              if (explicitInput) {
                throw new InputError(`No such file: ${err.path}`);
              }
            } else {
              throw new Error('Failed to read existing data', { cause: err });
            }
          }
        )
    );

    await oraPromise(
      spinner => updateData(spinner, itemsByName, context),
      {
        prefixText: `Looking up dependents data for ${moduleName}`,
        isSilent: !output || quiet,
      }
    );
  },
};

// Internal functions

/**
 * @param {string} name
 * @param {string} description
 * @param {string[]} args
 * @param {import('peowly-commands').CliMeta} meta
 * @returns {Promise<import('../cli-types.js').CommandContextLookup>}
 */
async function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...inputFlags,
    ...outputFlags,
    ...downloadFlags,
    ...filterFlags,
    check: {
      description: 'Check if list is outdated',
      listGroup: 'Update options',
      type: 'boolean',
    },
    'include-historic': {
      description: 'Useful while ecosyste.ms migrate their data to support ?latest=true for all packages',
      listGroup: 'Update options',
      type: 'boolean',
    },
  });

  const {
    flags: {
      check,
      debug,
      'include-historic': includeHistoric,
      quiet,
      ...remainingFlags
    },
    input: [moduleName, targetFile, ...otherInput],
    showHelp,
  } = peowly({
    args,
    description,
    examples: [
      { prefix: 'cat input-fixcole.ndjson |', suffix: 'installed-check > output-file.ndjson' },
      '-n installed-check',
      '-o foo.ndjson installed-check',
      'installed-check foo.ndjson',
      '--check installed-check foo.ndjson',
    ],
    name,
    options,
    pkg,
    usage: '<name-of-npm-module> [target-file.ndjson]',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one name is supported');
  }

  if (!moduleName) {
    showHelp();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }

  /** @type {import('../cli-types.js').CommandContextLookup} */
  const result = {
    check,
    debug,
    includeHistoric,
    moduleName,
    quiet,
    ...validateDownloadFlags(remainingFlags),
    ...validateFileFlags(remainingFlags, targetFile, moduleName),
    ...validateFilterFlags(remainingFlags),
  };

  return result;
}

const summaryDescription = {
  addSize: 'added',
  updateSize: 'updated',
  unchangedSize: 'unchanged',
  deleteSize: 'removed',
};

const checkSummaryDescription = {
  addSize: 'missing',
  updateSize: 'outdated',
  unchangedSize: 'up to date',
  deleteSize: 'extraneous',
};

/**
 * @param {import('ora').Ora} spinner
 * @param {import('../cli-types.js').CliDependentsCollection | undefined} itemsByName
 * @param {import('../cli-types.js').CommandContextLookup} context
 */
async function updateData (spinner, itemsByName, context) {
  const {
    check,
    debug,
    downloadPrecision,
    includeHistoric,
    includePkg,
    maxAge,
    maxPages,
    minDownloads,
    moduleName,
    output,
    pkgFields,
  } = context;

  const isUpdate = !!itemsByName;

  if (!itemsByName) {
    itemsByName = {};
  }

  const description = check ? checkSummaryDescription : summaryDescription;
  // eslint-disable-next-line no-console
  const logger = debug ? createLogger({ log: console.error.bind(console) }) : undefined;
  const skipPkg = !(includePkg || pkgFields?.length);
  const remainingKeys = new Set(Object.keys(itemsByName));

  const baseGenerator = fetchEcosystemDependents(moduleName, {
    includeHistoricDependents: !!includeHistoric,
    logger,
    maxAge,
    maxPages,
    minDownloadsLastMonth: minDownloads * 4,
    perPage: 100,
    skipPkg,
  });

  const generator = pkgFields
    ? formatItems(baseGenerator, { downloadPrecision, pkgFields })
    : baseGenerator;

  let count = 0;
  let addSize = 0;
  let updateSize = 0;
  let unchangedSize = 0;

  // FIXME: Fix error handling of generator
  for await (const item of generator) {
    remainingKeys.delete(item.name);

    count += 1;

    if (!isUpdate || !itemsByName[item.name]) {
      addSize += 1;
      itemsByName[item.name] = item;
    } else if (!isDeepStrictEqual(itemsByName[item.name], item)) {
      updateSize += 1;
      itemsByName[item.name] = item;
    } else {
      unchangedSize += 1;
    }

    spinner.text = formatSummary(description, {
      addSize,
      updateSize,
      unchangedSize,
    });
  }

  if (!count) {
    throw new ResultError('Found no new data');
  }

  const deleteSize = remainingKeys.size;

  for (const remainingKey of remainingKeys) {
    delete itemsByName[remainingKey];
  }

  if (!check) {
    await ndjsonOutput(Object.values(itemsByName), output);
  }

  if (addSize || updateSize || deleteSize) {
    spinner.text = formatSummary(description, {
      addSize,
      updateSize,
      unchangedSize,
      deleteSize,
    });

    if (check) {
      throw new ResultError('Outdated data');
    }
  } else {
    spinner.text = 'All up to date!';
  }
}
