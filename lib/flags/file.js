import { createReadStream } from 'node:fs';
import path from 'node:path';
import { cwd, stdin } from 'node:process';

import { InputError } from '../utils/errors.js';

export const inputFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'File options' }>} */ ({
  input: {
    description: 'Read data from the specified file',
    listGroup: 'File options',
    'short': 'i',
    type: 'string',
    'default': '',
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
 * @property {string|undefined} output
 */

/**
 * @overload
 * @param {InputFlags & OutputFlags} flags
 * @param {string|undefined} [targetFile]
 * @param {string} [moduleName]
 * @returns {import('../cli-types.d.ts').InputContext & { output: string|undefined }}
 */
/**
 * @overload
 * @param {OutputFlags} flags
 * @param {string|undefined} [targetFile]
 * @param {string} [moduleName]
 * @returns {{ output: string|undefined }}
 */
/**
 * @param {Partial<InputFlags> & OutputFlags} flags
 * @param {string|undefined} [targetFile]
 * @param {string} [moduleName]
 * @returns {Partial<import('../cli-types.d.ts').InputContext> & { output: string|undefined }}
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

  const namedOutput = (named && moduleName) ? `${moduleName.replaceAll('/', '__').replaceAll('@', '')}.ndjson` : undefined;

  const inputFile = targetFile || inputFlag || namedOutput;
  const outputFile = targetFile || outputFlag || namedOutput;

  const resolvedInputFile = inputFile ? path.resolve(cwd(), inputFile) : undefined;
  const output = outputFile ? path.resolve(cwd(), outputFile) : undefined;

  if (!('input' in flags)) {
    return { output };
  }

  const input = resolvedInputFile
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    ? createReadStream(resolvedInputFile, 'utf8')
    : (stdin.isTTY ? undefined : stdin);

  return {
    explicitInput: inputFile !== undefined && inputFile === inputFlag,
    input,
    modifyInPlace: resolvedInputFile ? resolvedInputFile === output : false,
    output,
  };
}
