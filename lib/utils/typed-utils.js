// Copied from @voxpelli/typed-utils

/**
 * @param {unknown} value
 * @returns {value is Error & { code: string }}
 */
export function isErrorWithCode (value) {
  return value instanceof Error && 'code' in value;
}

/**
 * @param {unknown} value
 * @returns {value is NodeJS.ErrnoException & { code: string, path: string }}
 */
export function looksLikeAnErrnoException (value) {
  return isErrorWithCode(value) && 'path' in value;
}

/**
 * @template {object} T
 * @template {keyof T} K
 * @param {T} input
 * @param {K[]|ReadonlyArray<K>} keys
 * @returns {Pick<T, K>}
 */
export function pick (input, keys) {
  /** @type {Partial<Pick<T, K>>} */
  const result = {};

  for (const key of keys) {
    if (key in input) {
      result[key] = input[key];
    }
  }

  return /** @type {Pick<T, K>} */ (result);
}

/**
 * @template {object} T
 * @template {keyof T} K
 * @param {T} input
 * @param {K[]|ReadonlyArray<K>} keys
 * @returns {Omit<T, K>}
 */
export function omit (input, keys) {
  const result = { ...input };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}
