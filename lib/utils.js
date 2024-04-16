/**
 * @template T
 * @param {T} obj
 * @param {string} key
 * @returns {key is keyof T}
 */
function isKeyOf (obj, key) {
  return obj && typeof obj === 'object' && key in obj;
}

/**
 * @template T
 * @template {string} K
 * @param {T} obj
 * @param {K} key
 * @returns {T[K & keyof T] | undefined}
 */
function geObjectValue (obj, key) {
  return isKeyOf(obj, key) ? obj[key] : undefined;
}

/**
 * @template T
 * @template {string} K
 * @param {T} obj
 * @param {K} key
 * @returns {string | undefined}
 */
export function getObjectStringValue (obj, key) {
  const value = geObjectValue(obj, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * @template T
 * @template {string} K
 * @param {T} obj
 * @param {K} key
 * @returns {number | undefined}
 */
export function getObjectNumericValue (obj, key) {
  const value = geObjectValue(obj, key);
  return typeof value === 'number' ? value : undefined;
}

/**
 * Array.isArray() on its own give type any[]
 *
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
export function typesafeIsArray (value) {
  return Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is Error & { code: string }}
 */
export function isErrorWithCode (value) {
  return value instanceof Error && 'code' in value;
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
    result[key] = input[key];
  }

  return /** @type {Pick<T, K>} */ (result);
}

/**
 * @param {import('node:stream').Readable} source
 * @returns {AsyncGenerator<unknown>}
 */
export async function * ndjsonParse (source) {
  let remaining = '';
  for await (const data of source) {
    const lines = (remaining + data).split('\n');
    remaining = lines.pop() || '';
    for (const line of lines) {
      yield JSON.parse(line);
    }
  }
}

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
