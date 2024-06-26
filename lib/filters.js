import intersect from 'semver/ranges/intersects.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {object} item
 * @param {number|undefined} maxAge
 * @returns {boolean}
 */
export function includeByAge (item, maxAge) {
  if (!maxAge) {
    return true;
  }

  if (!('latestRelease' in item) || typeof item.latestRelease !== 'string') {
    return false;
  }

  const ageInDays = (Date.now() - Date.parse(item.latestRelease)) / MS_PER_DAY;

  return ageInDays <= maxAge;
}

/**
 * @param {object} item
 * @param {number|undefined} minDownloads
 * @returns {boolean}
 */
export function includeByDownloads (item, minDownloads) {
  if (!minDownloads) {
    return true;
  }

  if (!('downloads' in item) || typeof item.downloads !== 'number') {
    return false;
  }

  return item.downloads >= minDownloads;
}

/**
 * @param {object} item
 * @param {string[]|undefined} repositoryPrefix
 * @returns {boolean}
 */
export function includeByRepositoryPrefix (item, repositoryPrefix) {
  if (!repositoryPrefix) {
    return true;
  }

  if (!('repositoryUrl' in item) || typeof item.repositoryUrl !== 'string') {
    return false;
  }

  for (const prefix of repositoryPrefix) {
    if (item.repositoryUrl.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {object} item
 * @param {string|undefined} targetVersion
 * @returns {boolean}
 */
export function includeByTargetVersion (item, targetVersion) {
  if (!targetVersion) {
    return true;
  }

  if (!('targetVersion' in item) || typeof item.targetVersion !== 'string') {
    return false;
  }

  try {
    return intersect(item.targetVersion, targetVersion, true);
  } catch {
    return false;
  }
}
