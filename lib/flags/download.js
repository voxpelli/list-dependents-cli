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
  'max-pages': {
    description: 'Max amount of pages to iterate through',
    listGroup: 'Download options',
    type: 'string',
  },
});

/**
 * @typedef DownloadFlags
 * @property {boolean} includePkg
 * @property {number|undefined} maxPages
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
    'max-pages': rawMaxPages,
  } = flags;

  const maxPages = rawMaxPages ? Number.parseInt(rawMaxPages) : undefined;

  if (maxPages !== undefined && Number.isNaN(maxPages)) {
    throw new InputError('Expected --max-pages to be numeric');
  }

  return {
    includePkg,
    maxPages,
    pkgFields,
  };
}
