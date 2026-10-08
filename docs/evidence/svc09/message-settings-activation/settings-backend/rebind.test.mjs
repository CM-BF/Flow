import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadSettingsBuild, TARGET } from './build-entry.mjs';
import { fixedCompositionPins } from '../host-integration/host-consumer.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('settings rebind actual build and host inputs select the reviewed eleven-leaf source', async () => {
  const { input, delta } = await loadSettingsBuild();
  assert.equal(TARGET, '00c84910d5ba1cfd1724a996a3649b8680de0e67');
  assert.equal(input.target, TARGET); assert.equal(delta.sourceChanges.length, 11);
  assert.equal(input.fixedSourceInputs.length, 80); assert.equal(input.sql.length, 33);
  assert.deepEqual(delta.sourceArchive, { files: 1001, logicalBytes: 7896835 });
  assert.equal(input.resources.additionalBudgetBytes, 2317352960);
  for (const pin of [...input.fixedSourceInputs, ...input.sql, ...delta.sourceDelta.supportTests]) {
    const bytes = await readFile(join(delta.sourceDirectory, pin.path));
    assert.equal(sha(bytes), pin.sha256, pin.path);
    if (pin.bytes !== undefined) assert.equal(bytes.length, pin.bytes, pin.path);
  }
  const composition = JSON.parse(await readFile(new URL('./host-source-composition.json', import.meta.url)));
  assert.deepEqual(fixedCompositionPins(composition, TARGET), delta.sourceChanges);
  const preparation = JSON.parse(await readFile(new URL('./build-preparation.json', import.meta.url)));
  assert.equal(preparation.source, TARGET); assert.equal(preparation.sourceTree, delta.sourceTree);
  for (const pin of preparation.bindings) {
    const bytes = await readFile(new URL(pin.path, import.meta.url));
    assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256);
  }
});
