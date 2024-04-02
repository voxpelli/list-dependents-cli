import { bufferedAsyncMap } from 'buffered-async-iterable';
import { getObjectNumericValue, getObjectStringValue } from './utils.js';
import { fetchPackageFromNpm } from './npm-helpers.js';
import { fetchJsonPages } from './json-helpers.js';

// TODO: Use got or undici instead of built in fetch?

/** @typedef {import('read-pkg').NormalizedPackageJson} NormalizedPackageJson */

/**
 * @param {string} name
 * @param {{ maxPages?: number|undefined, minDownloadsLastMonth?: number|undefined }} [options]
 * @returns {AsyncGenerator<{ downloads: number, name: string, pkg: NormalizedPackageJson }>}
 */
export async function * fetchEcosystemDependentPackages (name, { maxPages, minDownloadsLastMonth = 100 } = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('Expected a non-empty string name');

  /** @type {Set<string>} */
  const seen = new Set([name]);

  yield * bufferedAsyncMap(
    fetchJsonPages(`https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/${name}/dependent_packages`, { maxPages }),
    async function * (item) {
      const dependent = getObjectStringValue(item, 'name');

      if (!dependent || seen.has(dependent)) {
        return;
      }

      seen.add(dependent);

      const downloads = getObjectStringValue(item, 'downloads_period') === 'last-month' ? getObjectNumericValue(item, 'downloads') : undefined;

      if (downloads === undefined) {
        // TODO: Throw error?
        return;
      }

      const meta = {
        dependentCount: getObjectNumericValue(item, 'dependent_packages_count'),
        firstRelease: getObjectStringValue(item, 'first_release_published_at'),
        latestRelease: getObjectStringValue(item, 'latest_release_published_at'),
        downloads,
      };

      // TODO: Use a filter callback instead / also?
      if (downloads < minDownloadsLastMonth) {
        return;
      }

      const pkg = await fetchPackageFromNpm(dependent);

      if (pkg === undefined) {
        // TODO: Throw error?
        return;
      }

      yield {
        ...meta,
        name: dependent,
        pkg,
      };
    });
}
