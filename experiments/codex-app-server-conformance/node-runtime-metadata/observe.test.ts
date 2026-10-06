import { it, expect } from 'vitest';
import { observeRuntimeLoader } from './observe.mjs';
const token = '/opt/homebrew/opt/libuv/lib/libuv.1.dylib';
const roles = [{ token, role: 'runtime-44' }];
const observe = (reason: string, complete = true) => observeRuntimeLoader(Buffer.from(`dyld[123]: Library not loaded: ${token}\n  Reason: ${reason}\n`), roles, complete);
it.each([
  ['no such file', 'missing', null], ['not a file', 'not-file', null], ['blocked by sandbox', 'sandbox-stat', null],
  ['cannot override a protected system dylib', 'protected-override', null], ['errno=13', 'explicit-errno', 13],
])('recognizes search %s without inventing errno', (text, category, errno) => {
  const r = observe(`tried: '${token}' (${text})`);
  expect(r.reasons).toEqual([{ operation: 'search-stat', category, errno, dependencyRole: 'runtime-44' }]);
  expect(r.errno).toBe(errno); expect(r.reasonState).toBe('recognized-text'); expect(JSON.stringify(r)).not.toContain(token);
});
it('keeps distinct attempts and explicit errno conflicts instead of selecting the last error', () => {
  const r = observe(`tried: '${token}' (errno=1), '${token}' (errno=13, no dyld cache)`);
  expect(r.reasons.map((x: any) => x.errno)).toEqual([1, 13]); expect(r.errno).toBeNull(); expect(r.errnoState).toBe('conflict');
});
it.each([
  [`file system sandbox blocked stat("${token}")`, 'stat', 'sandbox-stat', null],
  [`stat("${token}") failed with errno=2`, 'stat', 'explicit-errno', 2],
  [`file system sandbox blocked mmap() of '${token}'`, 'mmap', 'sandbox-mmap', null],
  [`code signing blocked mmap() of '${token}'`, 'mmap', 'code-sign-mmap', null],
  [`mmap(addr=0x12, size=0x00001000) failed with errno=13 for ${token}`, 'mmap', 'explicit-errno', 13],
])('keeps the exact finite operation for %s', (reason, operation, category, errno) => {
  expect(observe(reason as string).reasons).toEqual([{ operation, category, errno, dependencyRole: 'runtime-44' }]);
});
it('unknown text/errno, partial role and private path never become a new public token or inferred cause', () => {
  for (const reason of [`tried: '${token}.other' (errno=13)`, `tried: '/Users/private/key' (blocked by sandbox)`]) {
    const r = observe(reason); expect(r.reasons[0].dependencyRole).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/Users|private|\.dylib/);
  }
  for (const reason of ['arbitrary stderr errno=13', `tried: '${token}' (errno=999)`, `tried: '${token}' (unrecognized text)`]) {
    const r = observe(reason); expect(r.errno).toBeNull(); expect(r.reasonState).toBe('partial-unknown');
  }
});
it('truncated/non-UTF8 observations preserve unknown and never parse copied prefixes', () => {
  expect(observe(`tried: '${token}' (errno=13)`, false).reasons).toEqual([]);
  expect(observeRuntimeLoader(Buffer.from([255]), roles, true).reasonState).toBe('UNKNOWN');
});
it('bounded reasons retain the unknown suffix marker and suppress addresses/PIDs', () => {
  const r = observe(Array.from({ length: 12 }, (_, i) => `'${token}' (errno=${i + 1})`).join(', ').replace(/^/, 'tried: '));
  expect(r.reasons).toHaveLength(8); expect(r.reasonState).toBe('partial-unknown'); expect(JSON.stringify(r)).not.toContain('123');
});

it('ninth valid attempt preserves errno conflict after the eight-detail cap', () => {
  const nineRoles = Array.from({ length: 9 }, (_, i) => ({ token: `/opt/homebrew/opt/fixture-${i}/lib.dylib`, role: `fixture-${i}` }));
  const tried = nineRoles.map((row, i) => `'${row.token}' (errno=${i === 8 ? 13 : 1})`).join(', ');
  const r = observeRuntimeLoader(Buffer.from(`Reason: tried: ${tried}\n`), nineRoles, true);
  expect(r.reasons).toHaveLength(8); expect(r.reasonState).toBe('partial-unknown');
  expect(r.errno).toBeNull(); expect(r.errnoState).toBe('conflict');
});
