import { InputError } from '../utils.js';

export const downloadFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'Download options' }>} */ ({
  field: {
    description: 'Narrow down the package.json fields to include',
    listGroup: 'Download options',
    multiple: true,
    type: 'string',
  },
  'include-pkg': {
    description: 'Include module\'s package.json file in result',
    listGroup: 'Download options',
    type: 'boolean',
    'default': false,
  },
  'max-age': {
    description: 'Max age in days of latest release',
    listGroup: 'Download options',
    type: 'string',
  },
  'max-pages': {
    description: 'Max amount of pages to iterate through',
    listGroup: 'Download options',
    type: 'string',
  },
  'min-downloads': {
    'default': '100',
    description: 'Min amount of weekly downloads needed to be included',
    listGroup: 'Download options',
    type: 'string',
  },
});

/**
 * @typedef DownloadFlags
 * @property {boolean} includePkg
 * @property {number|undefined} maxAge
 * @property {number|undefined} maxPages
 * @property {number} minDownloads
 * @property {string[]|undefined} pkgFields
 */

/**
 * @param {import("peowly").TypedFlags<typeof downloadFlags>} flags
 * @returns {DownloadFlags}
 */
export function validateDownloadFlags (flags) {
  const {
    field: pkgFields,
    'include-pkg': includePkg,
    'max-age': rawMaxAge,
    'max-pages': rawMaxPages,
    'min-downloads': rawMinDownloads,
  } = flags;

  const maxAge = rawMaxAge ? Number.parseInt(rawMaxAge) : undefined;
  const maxPages = rawMaxPages ? Number.parseInt(rawMaxPages) : undefined;
  const minDownloads = Number.parseInt(rawMinDownloads);

  if (maxAge !== undefined && Number.isNaN(maxAge)) {
    throw new InputError('Expected --max-age to be numeric');
  }
  if (maxPages !== undefined && Number.isNaN(maxPages)) {
    throw new InputError('Expected --max-pages to be numeric');
  }
  if (Number.isNaN(minDownloads)) {
    throw new InputError('Expected --min-downloads to be numeric');
  }

  return {
    includePkg,
    maxAge,
    maxPages,
    minDownloads,
    pkgFields,
  };
}
