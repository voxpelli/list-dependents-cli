import { pipeline } from 'node:stream/promises';

import { ndjsonParse } from './ndjson.js';
import { createReadStream } from 'node:fs';
/**
 * @param {NonNullable<import('../cli-types.js').InputContext['input']> | string} source
 * @param {import('ora').Ora} [spinner]
 * @returns {Promise<import('../cli-types.js').CliDependentsCollection>}
 */
export async function readDependentsCollection (source, spinner) {
  /** @type {import('../cli-types.js').CliDependentsCollection} */
  const itemsByName = {};
  let count = 0;

  const rawSource = typeof source === 'string'
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    ? createReadStream(source, 'utf8')
    : source;

  await pipeline(
    rawSource,
    ndjsonParse,
    async parsedSource => {
      for await (const item of parsedSource) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        if ('name' in item && typeof item.name === 'string') {
          count += 1;
          if (spinner) {
            spinner.text = `Found ${count} existing dependents`;
          }
          itemsByName[item.name] = /** @type {import('../cli-types.js').CliDependentsItem} */ (item);
        }
      }
    }
  );

  return itemsByName;
}
