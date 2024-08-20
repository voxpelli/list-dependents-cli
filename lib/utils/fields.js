import { precision } from './misc.js';
import { pick } from './typed-utils.js';

/**
 * @typedef ItemFormatOptions
 * @property {number|undefined} downloadPrecision
 * @property {string[]|undefined} pkgFields
 */

/**
 * @param {import('list-dependents').EcosystemDependentsItem} item
 * @param {ItemFormatOptions} options
 * @returns {import('../cli-types.d.ts').CliDependentsItem}
 */
export function formatItem (item, { downloadPrecision, pkgFields }) {
  const downloads = downloadPrecision && downloadPrecision > 0
    ? { downloads: precision(item.downloads, downloadPrecision) }
    : undefined;

  const pkg = item.pkg && pkgFields
    ? { pkg: pick(item.pkg, pkgFields) }
    : undefined;

  return downloads || pkg
    ? { ...item, ...downloads, ...pkg }
    : item;
}

/**
 * @param {AsyncGenerator<import('list-dependents').EcosystemDependentsItem, unknown, unknown>} generator
 * @param {ItemFormatOptions} options
 * @returns {AsyncGenerator<import('../cli-types.d.ts').CliDependentsItem, void, undefined>}
 */
export async function * formatItems (generator, options) {
  for await (const item of generator) {
    yield formatItem(item, options);
  }
}
