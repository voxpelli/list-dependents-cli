/**
 * @template {string} Key
 * @template {Partial<Record<Key, number|string|undefined>>} A
 * @template {Partial<Record<Key, number|string|undefined>>} B
 * @param {Key} key
 * @param {boolean} [desc]
 * @returns {(a: A, b: B) => 1|0|-1}
 */
export function sortByKey (key, desc) {
  return (a, b) => {
    const aCount = a?.[key] || 0;
    const bCount = b?.[key] || 0;
    if (aCount < bCount) {
      return desc ? 1 : -1;
    } else if (aCount > bCount) {
      return desc ? -1 : 1;
    }
    return 0;
  };
}

// TODO [engine:node@>=21] Probably able to use official Array.fromAsync() now instead
/**
 * @template T
 * @param {AsyncIterable<T>} source
 * @returns {Promise<T[]>}
 */
export async function arrayFromAsync (source) {
  /** @type {T[]} */
  const result = [];
  for await (const item of source) {
    result.push(item);
  }
  return result;
}

/**
 * @param {number} value
 * @param {number} precision
 * @returns {number}
 */
export function precision (value, precision) {
  const divideBy = Math.pow(10, precision);
  return Math.round(value / divideBy) * divideBy;
}
