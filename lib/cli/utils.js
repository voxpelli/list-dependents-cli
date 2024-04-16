export class InputError extends Error {
  /**
   * @param {string} message
   * @param {string} [body]
   */
  constructor (message, body) {
    super(message);

    /** @type {string|undefined} */
    this.body = body;
  }
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
