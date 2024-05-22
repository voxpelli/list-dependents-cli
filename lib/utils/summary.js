/**
 * @template {string} T
 * @param {Record<T, string>} descriptions
 * @param {Partial<Record<T, number>>} values
 * @returns {string}
 */
export function formatSummary (descriptions, values) {
  /** @type {string[]} */
  const messages = [];

  for (const machineName in descriptions) {
    if (values[machineName]) {
      messages.push(descriptions[machineName] + ' ' + values[machineName]);
    }
  }

  const result = messages.join(', ');

  return result.slice(0, 1).toUpperCase() + result.slice(1);
}
