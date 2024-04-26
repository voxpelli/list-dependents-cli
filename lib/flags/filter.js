import { InputError } from '../utils.js';

export const filterFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'Filter options' }>} */ ({
  'max-age': {
    description: 'Max age in days of latest release',
    listGroup: 'Filter options',
    type: 'string',
  },
  'min-downloads': {
    'default': '100',
    description: 'Min amount of weekly downloads needed to be included',
    listGroup: 'Filter options',
    type: 'string',
  },
});

/**
 * @typedef FilterFlags
 * @property {number|undefined} maxAge
 * @property {number} minDownloads
 */

/**
 * @param {import("peowly").TypedFlags<typeof filterFlags>} flags
 * @returns {FilterFlags}
 */
export function validateFilterFlags (flags) {
  const {
    'max-age': rawMaxAge,
    'min-downloads': rawMinDownloads,
    // TODO: Add a minDependents
    // 'min-dependents'
  } = flags;

  const maxAge = rawMaxAge ? Number.parseInt(rawMaxAge) : undefined;
  const minDownloads = Number.parseInt(rawMinDownloads);

  if (maxAge !== undefined && Number.isNaN(maxAge)) {
    throw new InputError('Expected --max-age to be numeric');
  }
  if (Number.isNaN(minDownloads)) {
    throw new InputError('Expected --min-downloads to be numeric');
  }

  return {
    maxAge,
    minDownloads,
  };
}
