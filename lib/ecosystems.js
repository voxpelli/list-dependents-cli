import { bufferedAsyncMap } from 'buffered-async-iterable';
import { createLogger } from 'bunyan-adaptor';

import { getObjectNumericValue, getObjectStringValue } from './utils.js';
import { fetchPackageFromNpm } from './npm-helpers.js';
import { fetchJsonPages } from './json-helpers.js';

// TODO: Use got or undici instead of built in fetch?

/**
 * @param {string} name
 * @param {import('./interface-types.d.ts').EcosystemDependentsOptions} [options]
 * @returns {AsyncGenerator<import('./interface-types.d.ts').EcosystemDependentsItem>}
 */
export async function * fetchEcosystemDependents (name, options = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('Expected a non-empty string name');

  const {
    logger = createLogger(),
    maxPages,
    minDownloadsLastMonth = 100,
  } = options;

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

      const downloads = getObjectStringValue(item, 'downloads_period') === 'last-month'
        ? getObjectNumericValue(item, 'downloads')
        : undefined;

      if (downloads === undefined) {
        if (logger) {
          logger.warn(`Skipping "${dependent}": Found no download count`);
        }
        return;
      }

      /** @type {import('./interface-types.d.ts').EcosystemDependentsMeta} */
      const meta = {
        dependentCount: getObjectNumericValue(item, 'dependent_packages_count'),
        downloads,
        firstRelease: getObjectStringValue(item, 'first_release_published_at'),
        latestRelease: getObjectStringValue(item, 'latest_release_published_at'),
        name: dependent,
      };

      // TODO: Use a filter callback instead / also?
      if (downloads < minDownloadsLastMonth) {
        logger && logger.debug(`Skipping "${dependent}", too few downloads: ${downloads}`);
        return;
      }

      const pkg = await fetchPackageFromNpm(dependent);

      if (pkg === undefined) {
        logger && logger.warn(`Skipping "${dependent}": Could not fetch its package.json file`);
        return;
      }

      /** @type {import('./interface-types.d.ts').EcosystemDependentsItem} */
      const result = {
        ...meta,
        pkg,
      };

      yield result;
    });
}
