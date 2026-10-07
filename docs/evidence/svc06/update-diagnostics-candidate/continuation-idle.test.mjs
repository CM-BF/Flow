import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runnerFiles } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/release-operation/runner-files.mjs';
import { assertRunnerIdle } from './maintenance-continuation.mjs';

const baseUrl = 'http://127.0.0.1:61227';
const namespace = createHash('sha256').update(baseUrl).digest('hex');
const idle = { version: 1, inFlight: null, assignments: [] };
async function fixture(use) {
  const root = await mkdtemp(join(tmpdir(), 'svc06-continuation-idle-'));
  try {
    const ns = join(root, namespace), attempt = join(ns, 'a'.repeat(64));
    await mkdir(attempt, { recursive: true, mode: 0o700 });
    const admission = join(ns, 'admission.json');
    await writeFile(admission, JSON.stringify(idle), { mode: 0o600 });
    const history = join(attempt, 'claude-result-00000000-0000-0000-0000-000000000000.txt');
    await writeFile(history, 'fixture retained history', { mode: 0o600 });
    const sample = await runnerFiles(root, baseUrl);
    const expected = { identity: { dev: sample.dev, ino: sample.ino, uid: sample.uid }, namespace, files: sample.files, totalBytes: sample.totalBytes };
    await use({ root, attempt, admission, history, expected, sample });
  } finally { await rm(root, { recursive: true }); }
}

test('real original reader plus fixed full inventory accepts idle without changing bytes', () => fixture(async f => {
  const bytes = await readFile(f.admission);
  assertRunnerIdle(await runnerFiles(f.root, baseUrl), f.expected);
  assert.deepEqual(await readFile(f.admission), bytes);
}));
test('pending events, uncertain events and pending/confirmed finals are all refused', () => fixture(async f => {
  for (const name of ['pending-events.json', 'uncertain-events.json', 'pending-final-proposal.json', 'confirmed-final-proposal.json']) {
    const path = join(f.attempt, name); await writeFile(path, '{}', { mode: 0o600 });
    assert.throws(() => assertRunnerIdle({ ...f.sample, files: [...f.sample.files, { path: namespace + '/' + 'a'.repeat(64) + '/' + name, bytes: 2, sha256: '0'.repeat(64) }] }, f.expected));
    const actual = await runnerFiles(f.root, baseUrl); assert.throws(() => assertRunnerIdle(actual, f.expected));
    assert.equal(await readFile(path, 'utf8'), '{}'); await rm(path);
  }
}));
test('changed or missing historical bytes fail the pinned complete inventory', () => fixture(async f => {
  await writeFile(f.history, 'different history');
  assert.throws(() => assertRunnerIdle({ ...f.sample, files: f.sample.files.slice(1) }, f.expected));
  const actual = await runnerFiles(f.root, baseUrl); assert.throws(() => assertRunnerIdle(actual, f.expected));
}));
test('fixed installation identity and exact namespace cannot be substituted', () => fixture(async f => {
  assert.throws(() => assertRunnerIdle(f.sample, { ...f.expected, identity: { ...f.expected.identity, ino: f.expected.identity.ino + 1 } }));
  assert.throws(() => assertRunnerIdle(f.sample, { ...f.expected, namespace: 'b'.repeat(64) }));
}));
test('real observer refuses non-idle v1 and unreviewed version2', () => fixture(async f => {
  for (const state of [{ ...idle, inFlight: 'unknown' }, { ...idle, assignments: [{ attemptId: 'unknown' }] }, { ...idle, version: 2 }]) {
    await writeFile(f.admission, JSON.stringify(state)); await assert.rejects(runnerFiles(f.root, baseUrl));
  }
}));
