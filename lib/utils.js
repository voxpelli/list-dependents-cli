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
