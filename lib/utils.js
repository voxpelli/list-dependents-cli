import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { cwd, stdout } from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export class InputError extends Error {
  /**
   * @param {string} message
   * @param {string} [body]
   */
  constructor (message, body) {
    super(message);

    /** @type {string|undefined} */
    this.body = body;
  }
}

export class ResultError extends Error {}

/**
 * @template {object} T
 * @template {keyof T} K
 * @param {T} input
 * @param {K[]|ReadonlyArray<K>} keys
 * @returns {Pick<T, K>}
 */
function pick (input, keys) {
  /** @type {Partial<Pick<T, K>>} */
  const result = {};

  for (const key of keys) {
    if (key in input) {
      result[key] = input[key];
    }
  }

  return /** @type {Pick<T, K>} */ (result);
}

/**
 * @param {Readable} source
 * @returns {AsyncGenerator<unknown, void, undefined>}
 */
export async function * ndjsonParse (source) {
  let remaining = '';
  // TODO: Type the stream
  // type-coverage:ignore-next-line
  for await (const data of source) {
    // type-coverage:ignore-next-line
    const lines = (remaining + data).split('\n');
    remaining = lines.pop() || '';
    for (const line of lines) {
      yield JSON.parse(line);
    }
  }
}

/**
 * @param {Readable} source
 * @returns {AsyncGenerator<string, void, undefined>}
 */
async function * ndjsonStringify (source) {
  // TODO: Type the stream
  // type-coverage:ignore-next-line
  for await (const data of source) {
    // type-coverage:ignore-next-line
    yield JSON.stringify(data) + '\n';
  }
}

/**
 * @param {AsyncIterable<object>|Iterable<object>} source
 * @param {string|undefined} output
 */
export async function ndjsonOutput (source, output) {
  await pipeline(
    Readable.from(source),
    ndjsonStringify,
    output
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      ? createWriteStream(resolve(cwd(), output), 'utf8')
      : stdout
  );
}

/**
 * @template {string} Key
 * @template {Partial<Record<Key, number|string|undefined>>} A
 * @template {Partial<Record<Key, number|string|undefined>>} B
 * @param {Key} key
 * @param {boolean} [desc]
 * @returns {(a: A, b: B) => 1|0|-1}
 */
export function sortByKey (key, desc) {
  return (a, b) => {
    const aCount = a?.[key] || 0;
    const bCount = b?.[key] || 0;
    if (aCount < bCount) {
      return desc ? 1 : -1;
    } else if (aCount > bCount) {
      return desc ? -1 : 1;
    }
    return 0;
  };
}

/**
 * @param {unknown} value
 * @returns {value is Error & { code: string }}
 */
export function isErrorWithCode (value) {
  return value instanceof Error && 'code' in value;
}

/**
 * @param {unknown} value
 * @returns {value is NodeJS.ErrnoException & { code: string, path: string }}
 */
export function looksLikeAnErrnoException (value) {
  return isErrorWithCode(value) && 'path' in value;
}

/**
 * @param {import('list-dependents').EcosystemDependentsItem} item
 * @param {string[]|undefined} pkgFields
 * @returns {import('./cli-types.d.ts').CliDependentsItem}
 */
export function resolveItemPkgFields (item, pkgFields) {
  return item.pkg && pkgFields
    ? { ...item, pkg: pick(item.pkg, pkgFields) }
    : item;
}

/**
 * @param {AsyncGenerator<import('list-dependents').EcosystemDependentsItem, unknown, unknown>} generator
 * @param {string[]|undefined} pkgFields
 * @returns {AsyncGenerator<import('./cli-types.d.ts').CliDependentsItem, void, undefined>}
 */
export async function * resolvePkgFields (generator, pkgFields) {
  for await (const item of generator) {
    yield resolveItemPkgFields(item, pkgFields);
  }
}

// TODO [engine:node@>=21] Probably able to use official Array.fromAsync() now instead
/**
 * @template T
 * @param {AsyncIterable<T>} source
 * @returns {Promise<T[]>}
 */
export async function arrayFromAsync (source) {
  /** @type {T[]} */
  const result = [];
  for await (const item of source) {
    result.push(item);
  }
  return result;
}

/**
 * @template {object} T
 * @template {keyof T} K
 * @param {T} input
 * @param {K[]|ReadonlyArray<K>} keys
 * @returns {Omit<T, K>}
 */
export function omit (input, keys) {
  const result = { ...input };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}
