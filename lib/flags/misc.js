export const baseFlags = /** @satisfies {Record<string, import("peowly").AnyFlag>} */ ({
  debug: {
    description: 'Use to output debug data',
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
