import { bufferedAsyncMap } from 'buffered-async-iterable';
import { extractLinksWithPrefix, fetchHtmlPages } from './html-helpers.js';
import { fetchDownloads, fetchPackageFromNpm } from './npm-helpers.js';

// TODO: Use got or undici instead of built in fetch?

/** @typedef {import('read-pkg').NormalizedPackageJson} NormalizedPackageJson */

// /**
//  * @callback FilterCallback
//  * @param {NormalizedPackageJson} pkg
//  * @returns {boolean|Promise<boolean>}
//  */

// /**
//  * @typedef ListDependentsOptions
//  * @property {FilterCallback} [filter]
//  */

/**
 * @param {string} name
 * @param {{ maxPages?: number|undefined }} options
 * @returns {AsyncGenerator<string>}
 */
export async function * fetchNpmDependents (name, { maxPages } = {}) {
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
 * @param {{ maxPages?: number|undefined, minDownloadsLastWeek?: number|undefined }} [options]
 * @returns {AsyncGenerator<{ downloads: number, name: string, pkg: NormalizedPackageJson }>}
 */
export async function * fetchNpmDependentPackages (name, { maxPages, minDownloadsLastWeek = 100 } = {}) {
  if (!name || typeof name !== 'string') throw new TypeError('Expected a non-empty string name');

  /** @type {Set<string>} */
  const seen = new Set([name]);

  yield * bufferedAsyncMap(fetchNpmDependents(name, { maxPages }), async function * (dependent) {
    if (seen.has(dependent)) {
      return;
    }

    seen.add(dependent);

    const downloads = await fetchDownloads(dependent);

    if (downloads === undefined || downloads < minDownloadsLastWeek) {
      // TODO: Throw error?
      return;
    }

    const pkg = await fetchPackageFromNpm(dependent);

    if (pkg === undefined) {
      // TODO: Throw error?
      return;
    }

    yield {
      downloads,
      name: dependent,
      pkg,
    };
  });
}
