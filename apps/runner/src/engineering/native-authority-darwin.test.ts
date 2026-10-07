import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createDarwinWriteProfile } from './native-authority-darwin.js';

test('policy input rejects noncanonical and executable write aliases', () => {
  assert.throws(() => createDarwinWriteProfile({ root: '/', executable: '/x', writableFile: '/calculator.mjs' }));
  assert.throws(() => createDarwinWriteProfile({ root: '/private/tmp/x/..', executable: '/x', writableFile: '/private/tmp/calculator.mjs' }));
  assert.throws(() => createDarwinWriteProfile({ root: '/private/tmp/x', executable: '/private/tmp/x/calculator.mjs', writableFile: '/private/tmp/x/calculator.mjs' }));
});
