import { bufferedAsyncMap } from 'buffered-async-iterable';
import { createLogger } from 'bunyan-adaptor';

import { extractLinksWithPrefix, fetchHtmlPages } from './html-helpers.js';
import { fetchDownloads, fetchPackageFromNpm } from './npm-helpers.js';

/**
 * @param {string} name
 * @param {{ maxPages?: number|undefined }} options
 * @returns {AsyncGenerator<string>}
 */
export async function * fetchNpmDependentList (name, { maxPages } = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('Expected a non-empty string name');

  yield * bufferedAsyncMap(
    fetchHtmlPages(
      `https://npmjs.com/browse/depended/${name}?offset=0`,
      `a[href^="/browse/depended/${name}?offset="]`,
      { maxPages }
    ),
    async function * (html) {
      yield * extractLinksWithPrefix(html, '/package/');
    },
    {
      bufferSize: 2,
    }
  );
}

/**
 * @param {string} name
 * @param {import('./interface-types.d.ts').NpmDependentsOptions} [options]
 * @returns {AsyncGenerator<import('./interface-types.d.ts').DependentsItem>}
 */
export async function * fetchNpmDependents (name, options = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('Expected a non-empty string name');

  const {
    logger = createLogger(),
    maxPages,
    minDownloadsLastWeek = 100,
  } = options;

  /** @type {Set<string>} */
  const seen = new Set([name]);

  yield * bufferedAsyncMap(fetchNpmDependentList(name, { maxPages }), async function * (dependent) {
    if (seen.has(dependent)) {
      return;
    }

    seen.add(dependent);

    const downloads = await fetchDownloads(dependent);

    if (downloads === undefined) {
      if (logger) {
        logger.warn(`Skipping "${dependent}": Found no download count`);
      }
      return;
    }

    /** @type {import('./interface-types.d.ts').DependentsMeta} */
    const meta = {
      downloads,
      name: dependent,
    };

    // TODO: Use a filter callback instead / also?
    if (downloads < minDownloadsLastWeek) {
      if (logger) {
        logger.debug(`Skipping "${dependent}", too few downloads: ${downloads}`);
      }
      return;
    }

    const pkg = await fetchPackageFromNpm(dependent);

    if (pkg === undefined) {
      if (logger) {
        logger.warn(`Skipping "${dependent}": Could not fetch its package.json file`);
      }
      return;
    }

    /** @type {import('./interface-types.d.ts').DependentsItem} */
    const result = {
      ...meta,
      pkg,
    };

    yield result;
  }, {
    // The download checks are very small and quick, so lets set this high to get a good throughput when minDownloadsLastWeek is high
    bufferSize: 12,
  });
}
