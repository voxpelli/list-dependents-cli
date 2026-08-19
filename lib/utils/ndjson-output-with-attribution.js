import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { cwd } from 'node:process';

import { ndjsonOutput } from './ndjson.js';

const SOURCE_ATTRIBUTION_FILENAME = 'ATTRIBUTION.md';
const SOURCE_ATTRIBUTION_CONTENT = `# Data attribution

The NDJSON data in this directory includes dependency data from [ecosyste.ms](https://ecosyste.ms/).

Please preserve this attribution when republishing the data. See the current terms and licence details at:

* https://ecosyste.ms/
* https://ecosyste.ms/terms
`;

/**
 * @param {AsyncIterable<object>|Iterable<object>} source
 * @param {string|undefined} output
 * @param {{ attributionOutput?: string | undefined, sourceFile?: boolean | undefined }} [options]
 */
export async function ndjsonOutputWithAttribution (source, output, options = {}) {
  const {
    attributionOutput = output,
    sourceFile = true,
  } = options;

  await ndjsonOutput(source, output);

  if (sourceFile && attributionOutput) {
    const attributionFile = path.join(
      path.dirname(path.resolve(cwd(), attributionOutput)),
      SOURCE_ATTRIBUTION_FILENAME
    );

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await writeFile(attributionFile, SOURCE_ATTRIBUTION_CONTENT, 'utf8');
  }
}
