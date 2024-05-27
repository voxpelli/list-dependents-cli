import { pick } from './typed-utils.js';

/**
 * @param {import('list-dependents').EcosystemDependentsItem} item
 * @param {string[]|undefined} pkgFields
 * @returns {import('../cli-types.d.ts').CliDependentsItem}
 */
export function resolveItemPkgFields (item, pkgFields) {
  return item.pkg && pkgFields
    ? { ...item, pkg: pick(item.pkg, pkgFields) }
    : item;
}

/**
 * @param {AsyncGenerator<import('list-dependents').EcosystemDependentsItem, unknown, unknown>} generator
 * @param {string[]|undefined} pkgFields
 * @returns {AsyncGenerator<import('../cli-types.d.ts').CliDependentsItem, void, undefined>}
 */
export async function * resolvePkgFields (generator, pkgFields) {
  for await (const item of generator) {
    yield resolveItemPkgFields(item, pkgFields);
  }
}
