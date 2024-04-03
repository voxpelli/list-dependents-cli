// TODO: Use got or undici instead of built in fetch?

import { typesafeIsArray } from './utils.js';

/**
 * @typedef JsonPagesOptions
 * @property {import('bunyan-adaptor').BunyanLite|undefined} [logger]
 * @property {number|undefined} [maxPages]
 * @property {string|undefined} [pageQueryParam]
 * @property {number|undefined} [pageStart]
 * @property {number|undefined} [perPage]
 * @property {string|undefined} [perPageQueryParam]
 */

/**
 * @param {string} baseUrl
 * @param {import('bunyan-adaptor').BunyanLite|undefined} logger
 * @param {JsonPagesOptions} options
 * @returns {AsyncGenerator<unknown, void, undefined>}
 */
export async function * fetchJsonPages (baseUrl, logger, options = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') throw new TypeError('Expected a non-empty string name');

  const {
    maxPages,
    pageQueryParam = 'page',
    pageStart = 1,
    perPage = 25,
    perPageQueryParam = 'per_page',
  } = options;

  const url = new URL(baseUrl);

  url.searchParams.set(perPageQueryParam, perPage + '');

  let page = pageStart;

  while (true) {
    if (maxPages && page - pageStart >= maxPages) {
      break;
    }

    url.searchParams.set(pageQueryParam, page + '');

    logger && logger.debug(`Fetching URL: ${url}`);

    // TODO: Add error handling
    const response = await fetch(url);
    const list = await response.json();

    if (!typesafeIsArray(list)) {
      break;
    }

    logger && logger.trace(`Yielding URL: ${url}`);

    yield * list;

    if (list.length < perPage) {
      break;
    }

    page += 1;
  }
}
