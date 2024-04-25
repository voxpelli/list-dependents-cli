import { InputError } from '../utils.js';

export const inputFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'File options' }>} */ ({
  input: {
    description: 'Read data from the specified file',
    listGroup: 'File options',
    'short': 'i',
    type: 'string',
  },
});
export const outputFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'File options' }>} */ ({
  named: {
    description: 'Read and write data to file with module name (<module-name>.ndjson)',
    listGroup: 'File options',
    'short': 'n',
    type: 'boolean',
    'default': false,
  },
  output: {
    description: 'Output data to the specified file',
    listGroup: 'File options',
    'short': 'o',
    type: 'string',
  },
});

/** @typedef {import("peowly").TypedFlags<typeof inputFlags>} InputFlags */
/** @typedef {import("peowly").TypedFlags<typeof outputFlags>} OutputFlags */

/**
 * @typedef FileFlags
 * @property {string|undefined} input
 * @property {string|undefined} output
 */

/**
 * @param {Partial<InputFlags> & OutputFlags} flags
 * @param {string|undefined} targetFile
 * @param {string} [moduleName]
 * @returns {FileFlags}
 */
export function validateFileFlags (flags, targetFile, moduleName) {
  const {
    input: inputFlag,
    named,
    output: outputFlag,
  } = flags;

  if ('input' in flags) {
    if (targetFile && inputFlag && outputFlag) {
      throw new InputError('Target file is superfluous when both --input and --output has been set');
    }
    if (named && inputFlag && outputFlag) {
      throw new InputError('--named is superfluous when both --input and --output has been set');
    }
  } else {
    if (targetFile && outputFlag) {
      throw new InputError('Target file is superfluous when --output has been set');
    }
    if (named && outputFlag) {
      throw new InputError('--named is superfluous when --output has been set');
    }
  }

  if (targetFile && named) {
    throw new InputError('--named is superfluous when target file is given');
  }

  const namedOutput = (named && moduleName) ? `${moduleName}.ndjson` : undefined;

  const input = targetFile || inputFlag || namedOutput;
  const output = targetFile || outputFlag || namedOutput;

  return {
    input,
    output,
  };
}
