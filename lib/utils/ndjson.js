import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { cwd, stdout } from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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
