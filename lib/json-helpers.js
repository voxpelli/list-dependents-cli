import createDebug from 'debug';

// TODO: Use linemod to remove this in ordinary dist, but leaving it in as a "/debug"
const debugFetchHtml = createDebug('list-dependents:html');

// TODO: Use got or undici instead of built in fetch?

/**
 * @param {string} baseUrl
 * @param {{ maxPages?: number|undefined, pageStart?: number|undefined, perPage?: number|undefined, pageQueryParam?: string|undefined, perPageQueryParam?: string|undefined }} options
 * @returns {AsyncGenerator<unknown>}
 */
export async function * fetchJsonPages (baseUrl, options = {}) {
  const {
    maxPages,
    pageQueryParam = 'page',
    pageStart = 1,
    perPage = 25,
    perPageQueryParam = 'per_page',
  } = options;

  if (!baseUrl || typeof baseUrl !== 'string') throw new TypeError('Expected a non-empty string name');

  const url = new URL(baseUrl);

  url.searchParams.set(perPageQueryParam, perPage + '');

  let page = pageStart;

  while (true) {
    if (maxPages && page - pageStart >= maxPages) {
      break;
    }

    url.searchParams.set(pageQueryParam, page + '');

    debugFetchHtml('Fetching URL: %s', url);

    // TODO: Add error handling
    const response = await fetch(url);
    const list = await response.json();

    if (!Array.isArray(list)) {
      break;
    }

    debugFetchHtml('Yielding URL: %s', url);
    yield * list;

    if (list.length < perPage) {
      break;
    }

    page += 1;
  }
}
