import createDebug from 'debug';

// TODO: Use linemod to remove this in ordinary dist, but leaving it in as a "/debug"
const debugFetchDownloads = createDebug('list-dependents:downloads');
const debugFetchPkg = createDebug('list-dependents:pkg');

/** @typedef {import('read-pkg').NormalizedPackageJson} NormalizedPackageJson */

/**
 * @param {string} name
 * @returns {Promise<NormalizedPackageJson|undefined>}
 */
export async function fetchPackageFromNpm (name) {
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
export async function fetchDownloads (name) {
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
