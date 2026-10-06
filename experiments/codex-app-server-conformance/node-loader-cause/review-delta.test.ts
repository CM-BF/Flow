import { it, expect } from 'vitest';
import fs from 'node:fs';
import { observeLoader } from './observe.mjs';
const roles = [{ token: '@rpath/libnode.137.dylib', role: 'node-library' }];
it('recognizes the anchored Apple dyld PID prefix without returning PID or text', () => {
  const value = observeLoader(Buffer.from('dyld[98765]: Library not loaded: @rpath/libnode.137.dylib\n'), roles, true);
  expect(value.errorClass).toBe('library-not-loaded'); expect(value.dependencyRoles).toEqual(['node-library']);
  expect(JSON.stringify(value)).not.toContain('98765'); expect(JSON.stringify(value)).not.toContain('@rpath');
});
it('outer completion gate observes the clock after the final receipt and byte reads', () => {
  const source = fs.readFileSync('experiments/codex-app-server-conformance/node-loader-cause/execute-window.sh', 'utf8');
  const close = source.lastIndexOf('exec 9>&-');
  const count = source.lastIndexOf('final_receipt_bytes=');
  const completion = source.lastIndexOf("completion_epoch=$(/bin/date -u '+%s')");
  expect(close).toBeGreaterThan(source.indexOf('self_bytes=')); expect(count).toBeGreaterThan(close); expect(completion).toBeGreaterThan(count);
  expect(source.slice(completion)).toContain('completion_epoch - start_epoch + 1');
  expect(source.slice(completion)).not.toMatch(/>&[0-9]/); // No automatic receipt remains after this final observation.
});
it.each(['dyld[0]: ', 'dyld[-1]: ', 'dyld[2147483648]: ', 'dyld[11111111111]: ', 'prefix dyld[123]: ', 'dyld: '])('rejects unsupported prefix %s', prefix => {
  expect(observeLoader(Buffer.from(`${prefix}Library not loaded: @rpath/libnode.137.dylib\n`), roles, true).errorClass).toBe('UNKNOWN');
});
