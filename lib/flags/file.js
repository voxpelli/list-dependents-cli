import { createReadStream } from 'node:fs';
import path from 'node:path';
import { cwd, stdin } from 'node:process';

import { InputError } from '../utils/errors.js';

/** @import { InputContext, FileContext, OutputContext } from '../cli-types.d.ts' */

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
 * @overload
 * @param {InputFlags} flags
 * @param {string|undefined} [targetFile]
 * @returns {InputContext}
 */
/**
 * @overload
 * @param {Partial<InputFlags>} flags
 * @param {string|undefined} targetFile
 * @param {{ namedOutput: string|undefined, filePath: string|undefined }} output
 * @returns {FileContext}
 */
/**
 * @param {Partial<InputFlags>} flags
 * @param {string|undefined} [targetFile]
 * @param {{ namedOutput: string|undefined, filePath: string|undefined }} [output]
 * @returns {Partial<FileContext> & InputContext}
 */
export function validateInputFlags (flags, targetFile, output) {
  const {
    input: inputFlag,
  } = flags;

  const inputFile = targetFile || inputFlag || output?.namedOutput;

  const resolvedInputFile = inputFile ? path.resolve(cwd(), inputFile) : undefined;

  const input = resolvedInputFile
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    ? createReadStream(resolvedInputFile, 'utf8')
    : (stdin.isTTY ? undefined : stdin);

  if (output) {
    return {
      explicitInput: inputFile !== undefined && inputFile === inputFlag,
      input,
      modifyInPlace: resolvedInputFile ? resolvedInputFile === output?.filePath : false,
      output: output?.filePath,
    };
  }

  return {
    explicitInput: inputFile !== undefined && inputFile === inputFlag,
    input,
  };
}

/**
 * @overload
 * @param {InputFlags & OutputFlags} flags
 * @param {string|undefined} [targetFile]
 * @param {string} [moduleName]
 * @returns {FileContext}
 */
/**
 * @overload
 * @param {OutputFlags} flags
 * @param {string|undefined} [targetFile]
 * @param {string} [moduleName]
 * @returns {OutputContext}
 */
/**
 * @param {Partial<InputFlags> & OutputFlags} flags
 * @param {string|undefined} [targetFile]
 * @param {string} [moduleName]
 * @returns {Partial<FileContext> & OutputContext}
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

  const outputFile = targetFile || outputFlag || namedOutput;

  const output = outputFile ? path.resolve(cwd(), outputFile) : undefined;

  if (!('input' in flags)) {
    return { output };
  }

  return validateInputFlags(flags, targetFile, { namedOutput, filePath: output });
}
