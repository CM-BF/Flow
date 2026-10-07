import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readRetainedCompatibility } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { findWebCompatibility } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-release.mjs';
import { legacyCompatibility } from '../continuation-facts.mjs';

const oldHead = 'af51c621696230fbced12227670f014ca73bd8a1', newHead = '6c0fdcda8858aac33489c48c1948e902dd6a3d7e';
const artifact = { artifactId: 'a'.repeat(64), manifestDigest: 'a'.repeat(64), sourceHead: 'b'.repeat(40) };
const context = { format: 1, publicOrigin: 'http://127.0.0.1:61228', policySha256: 'c'.repeat(64) };
const checks = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'],
  recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
const bytes = value => Buffer.from(JSON.stringify(value) + '\n');
const sha = value => createHash('sha256').update(value).digest('hex');
async function report(directory, format) {
  const backendHead = format === 1 ? oldHead : newHead, fields = format === 2 ? { context } : {};
  const documents = Object.fromEntries(Object.entries(checks).map(([check, names]) => [check, bytes({ format, check, backendHead, artifactId: artifact.artifactId, ...fields,
    observations: Object.fromEntries(names.map(name => [name, true])) })]));
  const content = bytes({ format, policy: 'flow-web-api-v' + format, backendHead, artifact, ...fields, checks: Object.fromEntries(Object.entries(documents).map(([name, value]) => [name, sha(value)])) });
  const id = sha(content), path = join(directory, 'web-compatibility', id); await mkdir(path, { recursive: true, mode: 0o700 });
  await writeFile(join(path, 'report.json'), content, { mode: 0o600 });
  for (const [name, value] of Object.entries(documents)) await writeFile(join(path, name + '.json'), value, { mode: 0o600 });
  return { id, path };
}
async function fixture(use) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'svc06-reader-port-')));
  try { await use(directory); } finally { await rm(directory, { recursive: true }); }
}
test('default original port continues to verify legacy v1 evidence', () => fixture(async directory => {
  const old = await report(directory, 1);
  assert.equal(await readRetainedCompatibility({ directory, artifact, backendHead: oldHead }), old.id);
}));
test('original default still rejects format2; reproduces reader limitation without personal I/O', () => fixture(async directory => {
  await report(directory, 2);
  await assert.rejects(readRetainedCompatibility({ directory, artifact, backendHead: oldHead }), { code: 'WEB_COMPATIBILITY_INVALID' });
}));
test('modern injected port distinguishes legacy-null from configured v2 in one mixed store', () => fixture(async directory => {
  const old = await report(directory, 1), modern = await report(directory, 2);
  assert.equal(await readRetainedCompatibility({ directory, artifact, backendHead: oldHead }, legacyCompatibility), old.id);
  assert.equal(await readRetainedCompatibility({ directory, artifact, backendHead: newHead, expectedContext: context }, findWebCompatibility), modern.id);
  await assert.rejects(findWebCompatibility({ directory, artifact, backendHead: newHead }), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
  assert.throws(() => legacyCompatibility({ directory, artifact, backendHead: newHead, expectedContext: context }));
}));
test('modern reader still refuses invalid report bytes rather than skipping or relabeling', () => fixture(async directory => {
  const modern = await report(directory, 2); await writeFile(join(modern.path, 'read.json'), '{}');
  await assert.rejects(readRetainedCompatibility({ directory, artifact, backendHead: oldHead }, legacyCompatibility), { code: 'WEB_COMPATIBILITY_INVALID' });
  assert.throws(() => readRetainedCompatibility({}, null), /COMPATIBILITY_READER_REQUIRED/);
}));
