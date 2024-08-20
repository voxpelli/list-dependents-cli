import { InputError } from '../utils/errors.js';

export const downloadFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'Download options' }>} */ ({
  field: {
    description: 'Narrow down which package.json fields to include',
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
  precision: {
    description: 'Precision to use for the downloads numbers',
    listGroup: 'Download options',
    type: 'string',
  },
});

/**
 * @param {import("peowly").TypedFlags<typeof downloadFlags>} flags
 * @returns {import('../cli-types.d.ts').DownloadFlags}
 */
export function validateDownloadFlags (flags) {
  const {
    field: pkgFields,
    'include-pkg': includePkg,
    'max-pages': rawMaxPages,
    precision: rawDownloadPrecision,
  } = flags;

  const maxPages = rawMaxPages ? Number.parseInt(rawMaxPages) : undefined;
  const downloadPrecision = rawDownloadPrecision ? Number.parseInt(rawDownloadPrecision) : undefined;

  if (maxPages !== undefined && Number.isNaN(maxPages)) {
    throw new InputError('Expected --max-pages to be numeric');
  }
  if (downloadPrecision !== undefined && Number.isNaN(downloadPrecision)) {
    throw new InputError('Expected --precision to be numeric');
  }
  return {
    downloadPrecision,
    includePkg,
    maxPages,
    pkgFields,
  };
}
