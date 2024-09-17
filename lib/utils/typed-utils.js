import { getValueByPath } from '@voxpelli/typed-utils';

/**
 * @param {unknown} obj
 * @param {string[]|string} path
 * @returns {string|undefined|false}
 */
export function getStringLikeValueByPath (obj, path) {
  const result = getValueByPath(obj, path);

  if (typeof result !== 'object') {
    return result;
  }

  switch (typeof result.value) {
    case 'string':
      return result.value;
    case 'number':
      return `${result.value}`;
    default:
      return false;
  }
}
