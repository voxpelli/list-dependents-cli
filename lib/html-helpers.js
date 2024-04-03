import { fromHtml } from 'hast-util-from-html';
import { selectAll } from 'hast-util-select';

// TODO: Use got or undici instead of built in fetch?

/**
 * @param {import('hast').Nodes} nodes
 * @param {string} prefix
 * @returns {Generator<string>}
 */
export function * extractLinksWithPrefix (nodes, prefix) {
  if (!prefix || typeof prefix !== 'string') throw new TypeError('Expected a non-empty string prefix');
  if (prefix.includes('"')) throw new Error(`Unexpected " character in prefix: ${prefix}`);

  const length = prefix.length;

  for (const elem of selectAll(`a[href^="${prefix}"]`, nodes)) {
    const { href } = elem.properties;
    if (typeof href === 'string') {
      const result = href.slice(length);
      yield result;
    }
  }
}

/**
 * @typedef HtmlPagesOptions
 * @property {import('bunyan-adaptor').BunyanLite|false|undefined} [logger]
 * @property {number|undefined} [maxPages]
 */

/**
 * @param {string} baseUrl
 * @param {string} nextSelector
 * @param {HtmlPagesOptions} options
 * @returns {AsyncGenerator<import('hast').Root>}
 */
export async function * fetchHtmlPages (baseUrl, nextSelector, options = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') throw new TypeError('Expected a non-empty string name');
  if (!nextSelector || typeof nextSelector !== 'string') throw new TypeError('Expected a non-empty string selector');

  const {
    logger,
    maxPages,
  } = options;

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

    logger && logger.debug(`Fetching URL: ${url}`);

    // TODO: Add error handling
    const response = await fetch(url);
    const text = await response.text();
    const html = fromHtml(text);

    const next = selectAll(nextSelector, html).pop()?.properties['href'];

    logger && logger.trace(`Yielding URL: ${url}`);

    yield html;

    if (typeof next !== 'string') {
      break;
    }

    url = new URL(next, url);
  }
}
