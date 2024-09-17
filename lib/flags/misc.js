export const baseFlags = /** @satisfies {Record<string, import("peowly").AnyFlag>} */ ({
  debug: {
    description: 'Use to output debug data',
    type: 'boolean',
    'default': false,
    'short': 'd',
  },
  quiet: {
    description: 'Disables progress output',
    type: 'boolean',
    'default': false,
    'short': 'q',
  },
});

export const formatFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'Format options' }>} */ ({
  field: {
    description: 'Narrow down which package.json fields to include (supports dot-separated paths)',
    listGroup: 'Format options',
    multiple: true,
    type: 'string',
  },
  markdown: {
    description: 'Format output as markdown',
    listGroup: 'Format options',
    type: 'boolean',
    'default': false,
  },
  'no-links': {
    description: 'Avoids adding links to the output',
    listGroup: 'Format options',
    type: 'boolean',
    'default': false,
  },
});

export const sortFlags = /** @satisfies {Record<string, import("peowly").AnyFlag & { listGroup: 'Sort options' }>} */ ({
  sort: {
    description: 'Sort by name',
    listGroup: 'Sort options',
    type: 'boolean',
    'default': false,
  },
  'sort-dependent': {
    description: 'Sort by dependents',
    listGroup: 'Sort options',
    type: 'boolean',
    'default': false,
  },
  'sort-download': {
    description: 'Sort by downloads',
    listGroup: 'Sort options',
    type: 'boolean',
    'default': false,
  },
});
