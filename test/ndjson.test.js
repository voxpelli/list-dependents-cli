import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

import { ndjsonOutput } from '../lib/utils/ndjson.js';
import { ndjsonOutputWithAttribution } from '../lib/utils/ndjson-output-with-attribution.js';

async function readTextFile (filePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFile(filePath, 'utf8');
}

nodeTest.test('writes NDJSON output without creating an attribution sidecar', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'list-dependents-cli-'));
  const outputFile = path.join(tmpDir, 'dependents.ndjson');

  try {
    await ndjsonOutput([{ name: 'example' }], outputFile);

    assert.equal(
      await readTextFile(outputFile),
      '{"name":"example"}\n'
    );

    await assert.rejects(
      readTextFile(path.join(tmpDir, 'ATTRIBUTION.md'))
    );
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

nodeTest.test('writes an attribution sidecar next to file output by default', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'list-dependents-cli-'));
  const outputFile = path.join(tmpDir, 'dependents.ndjson');

  try {
    await ndjsonOutputWithAttribution([{ name: 'example' }], outputFile);

    assert.match(
      await readTextFile(path.join(tmpDir, 'ATTRIBUTION.md')),
      /\[ecosyste\.ms\]\(https:\/\/ecosyste\.ms\/\)/
    );
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

nodeTest.test('can skip writing an attribution sidecar', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'list-dependents-cli-'));
  const outputFile = path.join(tmpDir, 'dependents.ndjson');

  try {
    await ndjsonOutputWithAttribution([{ name: 'example' }], outputFile, { sourceFile: false });

    await assert.rejects(
      readTextFile(path.join(tmpDir, 'ATTRIBUTION.md'))
    );
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

nodeTest.test('writes attribution next to the final output when using a temporary output file', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'list-dependents-cli-'));
  const tmpOutputDir = await mkdtemp(path.join(os.tmpdir(), 'list-dependents-cli-tmp-'));
  const outputFile = path.join(tmpDir, 'dependents.ndjson');
  const tmpFile = path.join(tmpOutputDir, 'dependents.ndjson');

  try {
    await ndjsonOutputWithAttribution([{ name: 'example' }], tmpFile, { attributionOutput: outputFile });

    assert.match(
      await readTextFile(path.join(tmpDir, 'ATTRIBUTION.md')),
      /Data attribution/
    );

    await assert.rejects(
      readTextFile(path.join(tmpOutputDir, 'ATTRIBUTION.md'))
    );
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
    await rm(tmpOutputDir, { force: true, recursive: true });
  }
});
