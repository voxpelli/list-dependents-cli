import { pipeline } from 'node:stream/promises';

import { peowly } from 'peowly';

import { inputFlags, validateInputFlags } from '../flags/file.js';
import { baseFlags, formatFlags } from '../flags/misc.js';
import { ndjsonParse } from '../utils/ndjson.js';
import { InputError } from '../utils/errors.js';
import { formatList } from '../utils/format.js';

/** @type {import('peowly-commands').CliCommand} */
export const format = {
  description: 'Pretty prints a list of dependents',
  async run (argv, meta, { parentName }) {
    const name = parentName + ' format';

    const context = await setupCommand(name, format.description, argv, meta);

    await commandAction(context);
  },
};

// Internal functions

/**
 * @param {string} name
 * @param {string} description
 * @param {string[]} args
 * @param {import('peowly-commands').CliMeta} meta
 * @returns {Promise<import('../cli-types.d.ts').CommandContextFormat>}
 */
async function setupCommand (name, description, args, { pkg }) {
  const options = /** @satisfies {import('peowly').AnyFlags} */ ({
    ...baseFlags,
    ...formatFlags,
    ...inputFlags,
  });

  const {
    flags: {
      debug,
      field: pkgFields,
      markdown,
      'no-links': skipLinks,
      quiet,
      ...remainingFlags
    },
    input: [targetFile, ...otherInput],
    showHelp,
  } = peowly({
    args,
    description,
    examples: [
      '-i input-file.ndjson',
      'input-file.ndjson',
      { prefix: 'cat input-file.ndjson |' },
    ],
    name,
    options,
    pkg,
    usage: '[input-file.ndjson]',
  });

  if (otherInput.length > 0) {
    throw new InputError('Only one input file is supported');
  }

  /** @type {import('../cli-types.d.ts').CommandContextFormat} */
  const result = {
    debug,
    markdown,
    pkgFields,
    quiet,
    skipLinks,
    ...validateInputFlags(remainingFlags, targetFile),
  };

  if (!result.input) {
    showHelp();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }

  return result;
}

/**
 * @param {import('../cli-types.d.ts').CommandContextFormat} context
 * @returns {Promise<void>}
 */
async function commandAction (context) {
  const {
    input,
    ...formatContext
  } = context;

  if (!input) {
    throw new InputError('No input given');
  }

  await pipeline(
    input,
    ndjsonParse,
    async collection => {
      await formatList(collection, formatContext);
    }
  );
}
