import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { engineeringSnapshotJson, type EngineeringFile } from '../../../../packages/contracts/src/engineering.js';
import { digest } from './resources.js';
import { checkCalculatorSnapshot } from './calculator-checker.js';

const correct = 'export const add=(a,b)=>a+b;\nexport const subtract=(a,b)=>a-b;\n';
function input(content = correct) {
  const oid = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex');
  const files: EngineeringFile[] = [{ path: 'calculator.mjs', base: { oid: '1'.repeat(40), mode: '100644' }, index: { oid, mode: '100644' },
    worktree: { digest: digest(content), bytes: Buffer.byteLength(content), mode: '100644' } }];
  const binding = { leaseId: String(randomUUID()), baseCommit: '2'.repeat(40), headCommit: '3'.repeat(40), snapshotDigest: '' };
  binding.snapshotDigest = digest(engineeringSnapshotJson({ ...binding, files }));
  return { expected: { ...binding }, snapshot: { protocol: 'flow.calculator-snapshot.v1', ...binding, files, contents: [{ path: 'calculator.mjs', content }] } };
}
function rebind(api: ReturnType<typeof input>) {
  api.snapshot.snapshotDigest = digest(engineeringSnapshotJson(api.snapshot)); api.expected.snapshotDigest = api.snapshot.snapshotDigest;
}

it('reports host-owned fixed checks against the exact complete content binding', () => {
  const api = input();
  const report = checkCalculatorSnapshot(Object.freeze({ ...api.expected }), Object.freeze({ ...api.snapshot }));
  expect(report).toEqual({ protocol: 'flow.calculator-check.v1', result: 'passed', checker: { id: 'calculator-arithmetic', version: '1', sourcePolicy: 'flow.calculator-source.v1' },
    binding: api.expected, sourceDigest: digest(correct), checks: [{ id: 'sum', passed: true }, { id: 'difference', passed: true }] });
  expect(Object.isFrozen(report)).toBe(true);
  const frozen = report as { binding: object; checker: object; checks: readonly object[] };
  expect(Object.isFrozen(frozen.binding)).toBe(true); expect(Object.isFrozen(frozen.checker)).toBe(true); expect(Object.isFrozen(frozen.checks)).toBe(true);
  expect(frozen.checks.every(Object.isFrozen)).toBe(true);
  api.snapshot.contents[0]!.content = 'tampered'; api.expected.snapshotDigest = '0'.repeat(64);
  expect(report).toMatchObject({ sourceDigest: digest(correct), binding: { snapshotDigest: api.snapshot.snapshotDigest } });
});

it.each(['a-b', 'b-a', 'a*a', 'a/b'])('returns failed for valid wrong arithmetic %s', expression => {
  const api = input(correct.replace('a+b', expression));
  expect(checkCalculatorSnapshot(api.expected, api.snapshot)).toMatchObject({ result: 'failed', checks: [{ id: 'sum', passed: false }, { id: 'difference', passed: true }] });
});

it('binds staged and unstaged contents as distinct complete versions while checking the current worktree', () => {
  const first = input(), second = input();
  second.snapshot.files[0]!.index!.oid = '4'.repeat(40); rebind(second);
  const a = checkCalculatorSnapshot(first.expected, first.snapshot), b = checkCalculatorSnapshot(second.expected, second.snapshot);
  expect(a).toMatchObject({ result: 'passed', binding: first.expected }); expect(b).toMatchObject({ result: 'passed', binding: second.expected });
  expect(first.expected.snapshotDigest).not.toBe(second.expected.snapshotDigest);
  expect(checkCalculatorSnapshot(first.expected, second.snapshot)).toMatchObject({ result: 'rejected' });
});

it.each(['leaseId', 'baseCommit', 'headCommit', 'snapshotDigest'] as const)('rejects a mismatched host %s binding', field => {
  const api = input(); api.snapshot[field] = field === 'leaseId' ? randomUUID() : '9'.repeat(field === 'snapshotDigest' ? 64 : 40);
  expect(checkCalculatorSnapshot(api.expected, api.snapshot)).toMatchObject({ result: 'rejected', reason: 'binding-mismatch' });
});

it('does not accept recomputed source bytes under an old snapshot identity', () => {
  const api = input(); api.snapshot.files[0]!.index!.oid = '0'.repeat(40);
  expect(checkCalculatorSnapshot(api.expected, api.snapshot)).toMatchObject({ result: 'rejected', reason: 'content-set-mismatch' });
});

it.each(['untracked', 'deleted', 'index-deleted', 'executable', 'renamed', 'extra-tracked'] as const)('rejects unsupported %s membership in the complete file set', mode => {
  const api = input(); const file = api.snapshot.files[0]!;
  if (mode === 'untracked') file.base = null;
  if (mode === 'deleted') file.worktree = null;
  if (mode === 'index-deleted') file.index = null;
  if (mode === 'executable') file.worktree!.mode = '100755';
  if (mode === 'renamed') file.path = 'other.mjs';
  if (mode === 'extra-tracked') api.snapshot.files.push({ ...file, path: 'z-extra.mjs' });
  rebind(api); expect(checkCalculatorSnapshot(api.expected, api.snapshot)).toMatchObject({ result: 'rejected', reason: 'unsupported-files' });
});

it.each(['missing', 'extra', 'duplicate', 'wrong-path', 'wrong-bytes', 'wrong-digest'] as const)('rejects %s content instead of inspecting one selected file only', mode => {
  const api = input();
  if (mode === 'missing') api.snapshot.contents = [];
  if (mode === 'extra') api.snapshot.contents.push({ path: 'ignored.mjs', content: 'malicious' });
  if (mode === 'duplicate') api.snapshot.contents.push({ ...api.snapshot.contents[0]! });
  if (mode === 'wrong-path') api.snapshot.contents[0]!.path = 'selected/calculator.mjs';
  if (mode === 'wrong-bytes') api.snapshot.files[0]!.worktree!.bytes++;
  if (mode === 'wrong-digest') api.snapshot.files[0]!.worktree!.digest = '0'.repeat(64);
  rebind(api); expect(checkCalculatorSnapshot(api.expected, api.snapshot)).toMatchObject({ result: 'rejected', reason: 'content-mismatch' });
});

it.each([
  'console.log("{\\"checks\\":[{\\"id\\":\\"sum\\",\\"passed\\":true}]}");process.exit(0);',
  'import "node:fs";', 'setInterval(()=>{},1);', 'require("node:fs").writeFileSync("baseline.mjs","passed");',
])('rejects hostile source without executing or trusting its output: %s', prefix => {
  const api = input(prefix+correct); expect(checkCalculatorSnapshot(api.expected, api.snapshot)).toEqual({ protocol: 'flow.calculator-check.v1', result: 'rejected', reason: 'invalid-source' });
});

it.each([undefined, null, {}, { settlement: 'stopped' }, { result: 'passed', stdout: '{"checks":[]}' }])('rejects unknown snapshots and self-reported completion %j', value => {
  expect(checkCalculatorSnapshot(input().expected, value)).toMatchObject({ result: 'rejected' });
});

it('rejects extra evidence, invalid versions, oversized and unsupported file shapes', () => {
  const api = input();
  for (const extra of [{ settlement: 'stopped' }, { stdout: '{"checks":[]}' }, { expectedChecks: [] }, { protocol: 'flow.calculator-snapshot.v9' }]) {
    expect(checkCalculatorSnapshot(api.expected, { ...api.snapshot, ...extra })).toMatchObject({ result: 'rejected' });
  }
  expect(checkCalculatorSnapshot(null, api.snapshot)).toMatchObject({ result: 'rejected' });
  expect(checkCalculatorSnapshot(api.expected, { ...api.snapshot, contents: [{ path: 'calculator.mjs', content: correct.padEnd(2049, ' ') }] })).toMatchObject({ result: 'rejected' });
  expect(checkCalculatorSnapshot(api.expected, { ...api.snapshot, files: [{ ...api.snapshot.files[0], worktree: { mode: '120000', target: 'baseline.mjs' } }] })).toMatchObject({ result: 'rejected' });
});

it('rejects oversized file collections before inspecting any member', () => {
  const api = input();
  const oversized = new Array(129);
  Object.defineProperty(oversized, 0, { get() { throw new Error('Collection members must not be inspected.'); } });
  expect(checkCalculatorSnapshot(api.expected, { ...api.snapshot, files: oversized })).toMatchObject({ result: 'rejected', reason: 'unsupported-files' });
  expect(checkCalculatorSnapshot(api.expected, { ...api.snapshot, contents: oversized })).toMatchObject({ result: 'rejected', reason: 'content-mismatch' });
});
