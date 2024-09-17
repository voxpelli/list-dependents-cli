import { semverIntersect } from '@voxpelli/semver-set';
import { getObjectValueByPath, getValueByPath } from '@voxpelli/typed-utils';
import {
  MarkdownOrChalk,
  mdastLinkify,
  mdastTableHelper,
} from 'markdown-or-chalk';
import { minVersion } from 'semver';

import { getStringLikeValueByPath } from '../utils/typed-utils.js';

/** @typedef {import('markdown-or-chalk').PhrasingContentOrStringList} PhrasingContentOrStringList */
/** @typedef {[PhrasingContentOrStringList, string, string, ...PhrasingContentOrStringList[]]} TableRow */

/**
 * @param {AsyncIterable<unknown>|import('../cli-types.d.ts').CliDependentsItem[]} collection
 * @param {import('../cli-types.d.ts').FormatContext} context
 * @returns {AsyncGenerator<string, void, undefined>}
 */
export async function * formatList (collection, context) {
  const {
    markdown,
    pkgFields = [],
    skipLinks,
  } = context;

  const format = new MarkdownOrChalk(markdown);

  /** @type {TableRow[]} */
  const tableData = [
    ['Name', 'Dependents', 'Downloads', ...pkgFields],
  ];

  /** @type {Record<string, string|undefined>} */
  const fieldSemVerIntersection = {};

  /** @type {Record<string, import('semver').SemVer|undefined>} */
  const fieldSemVerMin = {};

  /** @type {Record<string, string[]>} */
  const fieldSemVerMinNames = {};

  /** @type {Record<string, string[]>} */
  const fieldSemVerMinMajorNames = {};

  for (const field of pkgFields) {
    if (
      field.startsWith('engines.') ||
      field.startsWith('dependencies.') ||
      field.startsWith('devDependencies.') ||
      field.startsWith('peerDependencies.')
    ) {
      fieldSemVerIntersection[field] = '*';
      fieldSemVerMin[field] = undefined;
    }
  }

  for await (const item of collection) {
    const name = getStringLikeValueByPath(item, 'name');

    if (!name) {
      continue;
    }

    const pkg = pkgFields.length ? getObjectValueByPath(item, 'pkg') : undefined;

    /** @type {TableRow} */
    const row = [
      mdastLinkify(name, `https://www.npmjs.com/package/${name}`, skipLinks),
      getStringLikeValueByPath(item, 'dependentCount') || '',
      getStringLikeValueByPath(item, 'downloads') || '',
    ];

    for (const field of pkgFields) {
      const pathValue = getValueByPath(pkg, field.split('.'));

      if (!pathValue) {
        row.push('-');
        continue;
      }

      if (typeof pathValue.value !== 'string') {
        row.push([{
          type: 'inlineCode',
          value: JSON.stringify(pathValue.value),
        }]);
        continue;
      }

      row.push([{ type: 'inlineCode', value: pathValue.value }]);

      if (fieldSemVerIntersection[field]) {
        fieldSemVerIntersection[field] = semverIntersect(fieldSemVerIntersection[field], pathValue.value, { loose: true });
      }

      const min = minVersion(pathValue.value);

      if (min) {
        const comparison = fieldSemVerMin[field]?.compare(min);

        if (comparison === undefined || comparison === 1) {
          fieldSemVerMinMajorNames[field] = fieldSemVerMin[field]?.major === min.major
            ? [
                ...fieldSemVerMinMajorNames[field] || [],
                ...fieldSemVerMinNames[field] || [],
              ]
            : [];

          fieldSemVerMin[field] = min;
          fieldSemVerMinNames[field] = [name];
        } else if (comparison === 0) {
          fieldSemVerMinNames[field]?.push(name);
        }
      }
    }

    tableData.push(row);
  }

  yield format.header('Modules') + '\n';

  yield format.fromMdast(mdastTableHelper(
    tableData,
    ['left', 'right', 'right', ...pkgFields.map(() => /** @type {const} */ ('center'))]
  )) + '\n';

  /** @type {string[]} */
  const intersections = [];

  for (const [field, intersection] of Object.entries(fieldSemVerIntersection)) {
    if (intersection !== '*') {
      intersections.push(format.bold(field) + ': ' + (intersection || 'no overlapping version ranges'));
    }
  }

  if (intersections.length) {
    yield format.header('Intersection of versions', 2) + '\n';
    for (const item of intersections) {
      yield item + '\n';
    }
  }

  /** @type {string[]} */
  const minVersions = [];

  for (const [field, min] of Object.entries(fieldSemVerMin)) {
    minVersions.push(
      format.bold(field) + ': ' + (
        min
          ? min.format() + ' ' + format.italic(`(${fieldSemVerMinNames[field]?.join(', ')})`) +
            (
              fieldSemVerMinMajorNames[field]?.length
                ? ' ' + format.italic(`(Also including some ${min.major}.x.x release: ${fieldSemVerMinMajorNames[field]?.join(', ')})`)
                : ''
            )
          : 'no min version'
      )
    );
  }

  if (minVersions.length) {
    yield format.header('Lowest included versions', 2) + '\n';
    for (const item of minVersions) {
      yield item + '\n';
    }
  }
}
