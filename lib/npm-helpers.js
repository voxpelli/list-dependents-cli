/** @typedef {import('read-pkg').NormalizedPackageJson} NormalizedPackageJson */

// TODO: Use got or undici instead of built in fetch?

/**
 * @param {string} name
 * @param {import('bunyan-adaptor').BunyanLite|false|undefined} [logger]
 * @returns {Promise<NormalizedPackageJson|undefined>}
 */
export async function fetchPackageFromNpm (name, logger) {
  // TODO: Add error handling

  logger && logger.debug(`Fetching package: ${name}`);
  const res = await fetch(`https://registry.npmjs.org/${name}/latest`);

  const result = await res.json();

  if (
    result && typeof result === 'object' &&
    '_id' in result && typeof result._id === 'string' &&
    'name' in result && typeof result.name === 'string'
  ) {
    logger && logger.debug(`Returning package: ${name}`);
    return /** @type {NormalizedPackageJson} */ (result);
  }

  // TODO: Throw error?
}

/**
 * @param {string} name
 * @param {import('bunyan-adaptor').BunyanLite|false|undefined} [logger]
 * @returns {Promise<number|undefined>}
 */
export async function fetchDownloads (name, logger) {
  // TODO: Add error handling

  logger && logger.debug(`Fetching downloads: ${name}`);
  const resp = await fetch(`https://api.npmjs.org/downloads/point/last-week/${name}`);

  const result = await resp.json();

  if (result && typeof result === 'object' && 'downloads' in result && typeof result.downloads === 'number') {
    logger && logger.trace(`Returning downloads: ${name}`);
    return result.downloads;
  }

  // TODO: Throw error?
}
