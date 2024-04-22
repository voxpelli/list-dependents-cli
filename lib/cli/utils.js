import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { pick } from '../utils.js';

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
 * @param {AsyncGenerator<object, unknown, unknown>|Iterable<object>} source
 * @param {string|undefined} output
 */
export async function ndjsonOutput (source, output) {
  await pipeline(
    Readable.from(source),
    ndjsonStringify,
    output
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      ? createWriteStream(join(process.cwd(), output), 'utf8')
      : process.stdout
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
 * @param {AsyncGenerator<import('../../index.js').EcosystemDependentsItem, unknown, unknown>} generator
 * @param {string[]|undefined} pkgFields
 * @returns {AsyncGenerator<import('./cli-types.d.ts').CliDependentsItem, void, undefined>}
 */
export async function * resolvePkgFields (generator, pkgFields) {
  for await (const item of generator) {
    yield item.pkg && pkgFields
      ? { ...item, pkg: pick(item.pkg, pkgFields) }
      : item;
  }
}
