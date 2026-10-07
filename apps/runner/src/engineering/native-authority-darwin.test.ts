import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { createDarwinWriteProfile, createStockHelperProfile, createStockReadOnlyProfile, STOCK_CODEX } from './native-authority-darwin.js';

test('policy input rejects noncanonical and executable write aliases', () => {
  assert.throws(() => createDarwinWriteProfile({ root: '/', executable: '/x', writableFile: '/calculator.mjs' }));
  assert.throws(() => createDarwinWriteProfile({ root: '/private/tmp/x/..', executable: '/x', writableFile: '/private/tmp/calculator.mjs' }));
  assert.throws(() => createDarwinWriteProfile({ root: '/private/tmp/x', executable: '/private/tmp/x/calculator.mjs', writableFile: '/private/tmp/x/calculator.mjs' }));
});

// This is an exact, declared fixed input; historical evidence fixture must stay materialized.
const startupRecipe = readFileSync(new URL('../../../../docs/evidence/eng01j/helper-host/startup-input.sb', import.meta.url), 'utf8');
const helperPaths = { startupRecipe, directory: '/private/tmp/helper-workspace', runtimeDirectory: '/private/tmp/helper-runtime' };

test('ENG01L read-only profile removes exactly the helper workspace write without widening startup resources', () => {
  const readonly = createStockReadOnlyProfile(helperPaths), helper = createStockHelperProfile(helperPaths);
  assert.equal(helper, readonly + '(allow file-write-data (literal "/private/tmp/helper-workspace/calculator.mjs"))\n');
  assert.equal(readonly.includes('calculator.mjs'), false);
  assert.equal(readonly.match(/\(allow file-read\* file-write\*/g)?.length, 1);
  assert.ok(readonly.includes('(allow file-read* file-write* (subpath (string-append "/private/tmp/helper-runtime" "/state")))'));
  for (const denial of ['process-fork', 'network*', 'mach-lookup']) assert.ok(readonly.includes(`(deny ${denial})`));
  assert.ok(readonly.includes('(allow file-read* (subpath "/private/tmp/helper-workspace"))'));
  assert.throws(() => createStockReadOnlyProfile({ ...helperPaths, startupRecipe: startupRecipe + '\n' }));
  assert.throws(() => createStockReadOnlyProfile({ ...helperPaths, runtimeDirectory: helperPaths.directory }));
});

test('stock helper policy separates runtime writes from the single existing workspace file', () => {
  const profile = createStockHelperProfile(helperPaths);
  assert.ok(profile.includes('(allow file-read* file-write* (subpath (string-append "/private/tmp/helper-runtime" "/state")))'));
  assert.ok(profile.includes('(allow file-read* (subpath "/private/tmp/helper-workspace"))'));
  assert.ok(profile.includes('(allow file-write-data (literal "/private/tmp/helper-workspace/calculator.mjs"))'));
  assert.equal(profile.match(/\(allow process-exec /g)?.length, 1);
  assert.ok(profile.includes(`(allow process-exec (literal "${STOCK_CODEX}"))`));
  for (const denial of ['process-fork', 'network*', 'mach-lookup']) assert.ok(profile.includes(`(deny ${denial})`));
  assert.ok(profile.includes('(allow sysctl-read (sysctl-name "hw.pagesize_compat"))'));
  assert.ok(!profile.includes('(param '));
});

test('stock helper policy rejects altered recipes, overlap, path escapes and control characters', () => {
  assert.throws(() => createStockHelperProfile({ ...helperPaths, startupRecipe: startupRecipe + '\n' }));
  for (const directory of ['/private/tmp/helper-runtime', '/private/tmp/helper-runtime/child', '/private/tmp',
    '/Users/owner', '/private/tmp/x/../y', '/private/tmp/a\n(allow default)', '/private/tmp/' + 'x'.repeat(4096)]) {
    assert.throws(() => createStockHelperProfile({ ...helperPaths, directory }));
  }
  assert.throws(() => createStockHelperProfile({ ...helperPaths, runtimeDirectory: helperPaths.directory + '/state' }));
  const escaped = createStockHelperProfile({ ...helperPaths, directory: '/private/tmp/a"b' });
  assert.ok(escaped.includes('(literal "/private/tmp/a\\"b/calculator.mjs")'));
});
