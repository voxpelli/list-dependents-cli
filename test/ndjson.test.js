import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';

import { ndjsonOutput } from '../lib/utils/ndjson.js';

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
