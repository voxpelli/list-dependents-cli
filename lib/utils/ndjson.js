import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cwd, stdout } from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SOURCE_ATTRIBUTION_FILENAME = 'ATTRIBUTION.md';
const SOURCE_ATTRIBUTION_CONTENT = `# Data attribution

The NDJSON data in this directory includes dependency data from [ecosyste.ms](https://ecosyste.ms/).

Please preserve this attribution when republishing the data. See the current terms and licence details at:

* https://ecosyste.ms/
* https://ecosyste.ms/terms
`;

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
 * @param {{ attributionOutput?: string | undefined, sourceFile?: boolean | undefined }} [options]
 */
export async function ndjsonOutput (source, output, options = {}) {
  const {
    attributionOutput = output,
    sourceFile = true,
  } = options;

  await pipeline(
    Readable.from(source),
    ndjsonStringify,
    output
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      ? createWriteStream(path.resolve(cwd(), output), 'utf8')
      : stdout
  );

  if (sourceFile && attributionOutput) {
    const attributionFile = path.join(
      path.dirname(path.resolve(cwd(), attributionOutput)),
      SOURCE_ATTRIBUTION_FILENAME
    );

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await writeFile(attributionFile, SOURCE_ATTRIBUTION_CONTENT, 'utf8');
  }
}
