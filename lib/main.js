import { bufferedAsyncMap } from 'buffered-async-iterable';
import createDebug from 'debug';
import { fromHtml } from 'hast-util-from-html';
import { selectAll } from 'hast-util-select';

// TODO: Use linemod to remove this in ordinary dist, but leaving it in as a "/debug"
const debugFetchDownloads = createDebug('list-dependents:downloads');
const debugFetchHtml = createDebug('list-dependents:html');
const debugFetchLinks = createDebug('list-dependents:links');
const debugFetchPkg = createDebug('list-dependents:pkg');

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
 * @param {import('hast').Nodes} nodes
 * @param {string} prefix
 * @returns {Generator<string>}
 */
function * extractLinksWithPrefix (nodes, prefix) {
  if (!prefix || typeof prefix !== 'string') throw new TypeError('Expected a non-empty string prefix');
  if (prefix.includes('"')) throw new Error(`Unexpected " character in prefix: ${prefix}`);

  const length = prefix.length;

  for (const elem of selectAll(`a[href^="${prefix}"]`, nodes)) {
    const { href } = elem.properties;
    if (typeof href === 'string') {
      const result = href.slice(length);
      debugFetchLinks('Yielding link: %s', result);
      yield result;
    }
  }
}

/**
 * @param {string} baseUrl
 * @param {string} nextSelector
 * @param {{ maxPages?: number|undefined }} options
 * @returns {AsyncGenerator<import('hast').Root>}
 */
async function * fetchHtmlPages (baseUrl, nextSelector, { maxPages } = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') throw new TypeError('Expected a non-empty string name');
  if (!nextSelector || typeof nextSelector !== 'string') throw new TypeError('Expected a non-empty string name');

  /** @type {Set<string>} */
  const fetched = new Set();

  let url = new URL(baseUrl);

  while (true) {
    if (fetched.has(url.toString())) {
      break;
    }

    if (maxPages && fetched.size >= maxPages) {
      break;
    }

    fetched.add(url.toString());

    debugFetchHtml('Fetching URL: %s', url);

    // TODO: Add error handling
    const response = await fetch(url);
    const text = await response.text();
    const html = fromHtml(text);

    const next = selectAll(nextSelector, html).pop()?.properties['href'];

    debugFetchHtml('Yielding URL: %s', url);

    yield html;

    if (typeof next !== 'string') {
      break;
    }

    url = new URL(next, url);
  }
}

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
 * @returns {Promise<NormalizedPackageJson|undefined>}
 */
async function fetchPackageFromNpm (name) {
  // TODO: Add error handling
  debugFetchPkg('Fetching package: %s', name);
  const res = await fetch(`https://registry.npmjs.org/${name}/latest`);

  const result = await res.json();

  if (
    result && typeof result === 'object' &&
    '_id' in result && typeof result._id === 'string' &&
    'name' in result && typeof result.name === 'string'
  ) {
    debugFetchPkg('Returning package: %s', name);
    return /** @type {NormalizedPackageJson} */ (result);
  }

  // TODO: Throw error?
}

/**
 * @param {string} name
 * @returns {Promise<number|undefined>}
 */
async function fetchDownloads (name) {
  // TODO: Add error handling
  const endpoint = `https://api.npmjs.org/downloads/point/last-week/${name}`;
  debugFetchDownloads('Fetching downloads: %s', name);
  const resp = await fetch(endpoint);
  const result = await resp.json();

  if (result && typeof result === 'object' && 'downloads' in result && typeof result.downloads === 'number') {
    debugFetchDownloads('Returning downloads: %s', name);
    return result.downloads;
  }

  // TODO: Throw error?
}

/**
 * @param {string} name
 * @param {{ maxPages?: number|undefined, minDownloadsLastWeek?: number|undefined }} [options]
 * @returns {AsyncGenerator<{ downloads: number, name: string, pkg: NormalizedPackageJson }>}
 */
export async function * fetchNpmDependentsPackages (name, { maxPages, minDownloadsLastWeek = 100 } = {}) {
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

const name = process.argv[2] || 'c8';
const minDownloadsLastWeek = process.argv[3] ? Number.parseInt(process.argv[3]) : 100;
const maxPages = process.argv[4] ? Number.parseInt(process.argv[4]) : undefined;

for await (const yay of fetchNpmDependentsPackages(name, { minDownloadsLastWeek, maxPages })) {
  console.log('yay', yay.downloads, yay.name, yay.pkg.description);
}
