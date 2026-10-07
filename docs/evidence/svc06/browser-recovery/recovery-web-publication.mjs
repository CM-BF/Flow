/** Fixed Web-only successor. Existing transfer and public release CAS own mutations. */
import assert from 'node:assert/strict';
import { mkdir, lstat, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transferWebArtifact } from './current-web-transfer.mjs';
import { observeCurrentInstallation } from './current-migration.mjs';
import { readInstance } from './current-import.mjs';
import { verifyBackendArtifact } from '../../../../tools/personal-preview/backend-release/index.mjs';
import { record } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';
import { privateBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';
import { renameExclusive } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/artifact-transfer/import-d629.mjs';

export const backend = Object.freeze({ policy: 'flow.backend-artifact.v1', artifactId: 'e15dd368379a2be90b3c0c9d083cf27f9c26770e425e60e8cf078a127c9f15dd', manifestDigest: 'e15dd368379a2be90b3c0c9d083cf27f9c26770e425e60e8cf078a127c9f15dd', sourceHead: '880060a317cd99f3f29b41333f6dd7d7f5ab1488' });
export const artifact = Object.freeze({ artifactId: '779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4', manifestDigest: '779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4', sourceHead: 'c2311b6bd44a2a8e73e3b066be5f12bc8b153b37' });
export const reports = Object.freeze({
  '461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90': '41580d34c28e56812af28f39380de7b458007d227ac172d8a4d98bdffb3ec698',
  'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe': '6056fec5fb6e7c4ac17acc80cf753aa48ace7bf641e92c78c254c6fa63829117',
  'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88': '9337b9d2405e2d038eb37a1febb148b82e8685481e21a3d4e80c79a8ab7d17e1',
  '779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4': 'b81567e6c2a471a072f924d6d6f9c5b902d63ae4a8087b2c6c2f8be88dbbc30c',
});
export const context = Object.freeze({ format: 1, publicOrigin: 'http://127.0.0.1:61228', policySha256: '81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638' });
const roles = ['center', 'runner', 'web'], files = ['browser-session.json', 'claude.json', 'config.json', 'maintenance.json', 'state.json', 'web-release.json'];
const oldIds = Object.keys(reports).slice(0, 3), runnerId = 'd22f4df2-8242-49f4-a1b4-77f8f08611ef', operationId = '35d5a7ff-5ef7-4938-9584-adb27f5357ff';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = value => { assert.deepEqual(Object.keys(value).sort(), ['dev', 'ino']); for (const part of Object.values(value)) assert.match(part, /^\d+$/); };
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);

export function validateInput(input) {
  assert.equal(input.ready, true, 'FRESH_POST_RECOVERY_INSTANCE_REQUIRED');
  assert.equal(input.installationDirectory, '/Users/citrine/.flow-personal');
  assert.equal(input.repository, '/Users/citrine/Projects/AgentHarness/Flow');
  assert.equal(input.sourceDirectory, '/private/tmp/release01-web-artifact-prepared-20261007/actual/artifact-store');
  assert.equal(input.runDirectory, '/private/tmp/flow-svc06b-e15-web779-transfer-once');
  assert.equal(input.publicationDirectory, '/private/tmp/flow-svc06b-e15-web779-publish-once');
  assert.equal(input.runIdentity, null);
  assert.deepEqual(input.expectedBackendArtifact, backend); assert.deepEqual(input.expectedWebHostArtifact, backend);
  assert.deepEqual(input.expectedSource, { head: backend.sourceHead, dirty: false }); assert.deepEqual(input.artifact, artifact);
  assert.deepEqual(input.context, context); assert.deepEqual(input.reportIds, reports);
  assert.deepEqual(input.retainedArtifacts.map(value => value.artifactId), oldIds);
  for (const value of input.retainedArtifacts) { assert.equal(value.manifestDigest, value.artifactId); assert.match(value.sourceHead, /^[a-f0-9]{40}$/); }
  assert.equal(input.expectedRelease.version, 3); assert.equal(input.expectedRelease.current, oldIds[2]);
  assert.deepEqual(input.expectedRelease.artifacts, input.retainedArtifacts);
  assert.deepEqual(Object.keys(input.privateFiles).sort(), files);
  for (const value of Object.values(input.privateFiles)) { identity({ dev: value.dev, ino: value.ino }); hash(value.sha256); assert.ok(value.bytes > 0 && value.bytes <= 65536); }
  for (const value of [input.installationIdentity, input.sourceIdentity]) identity(value);
  assert.deepEqual(Object.keys(input.processDigests).sort(), roles); Object.values(input.processDigests).forEach(hash);
  assert.deepEqual(input.ports, { center: 61227, web: 61228 });
  assert.equal(input.finalReceipt.path, '/private/tmp/flow-svc06-held-recovery-e15-continuation-r2-20261007-once/final.json');
  hash(input.finalReceipt.sha256); assert.ok(input.finalReceipt.bytes > 0 && input.finalReceipt.bytes <= 65536);
  assert.equal(input.artifactFiles, 10); assert.equal(input.assetBytes, 1700569); assert.equal(input.manifestBytes, 1651);
  assert.equal(input.releaseId, '52a261e294324a11aead58a554f547db');
  assert.ok(input.budget.freshBytes >= 2.5 * 1024 ** 3); assert.equal(input.budget.liveBytes, 1024 ** 3);
  assert.equal(input.budget.addedBytes, 512 * 1024 ** 2); assert.equal(input.budget.rawBytes, 2 * 1024 ** 2);
  return input;
}
export function assertRecoveryReceipt(value) {
  assert.equal(value.outcome, 'resumed-confirmed'); assert.equal(value.complete, true); assert.equal(value.phase, 'final');
  assert.equal(value.view.state, 'accepting'); assert.equal(value.view.version, 24); assert.equal(value.view.operationId, null); assert.equal(value.view.runnerId, runnerId);
  assert.equal(value.initialization, true); hash(value.stateDigest); hash(value.operationDigest);
  for (const role of roles) { assert.equal(value.processes[role], 'running'); assert.equal(value.oldGroups[role], 'absent'); }
  assert.deepEqual(value.tuple, { backendHead: backend.sourceHead, context, compatibilityIds: Object.fromEntries(oldIds.map(id => [id, reports[id]])) });
  // Actual user assignment is deliberately not an acceptance predicate for Web publication.
}
async function json(path) { return JSON.parse((await privateBytes(path, 65536)).bytes); }
async function directory(path) {
  const info = await lstat(path); assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
  assert.equal(await realpath(path), path); return { dev: String(info.dev), ino: String(info.ino) };
}
/** System temporary parent and newly owned output have distinct permission contracts. */
export async function createOutputDirectory(output) {
  const parent = dirname(output), info = await lstat(parent);
  assert.ok(info.isDirectory() && !info.isSymbolicLink()); assert.equal(await realpath(parent), parent);
  const ownedPrivate = info.uid === process.getuid() && (info.mode & 0o7777) === 0o700;
  const systemTemporary = parent === '/private/tmp' && info.uid === 0 && (info.mode & 0o7777) === 0o1777;
  assert.ok(ownedPrivate || systemTemporary, 'UNTRUSTED_OUTPUT_PARENT');
  await mkdir(output, { mode: 0o700 }); // Exclusive; never adopt an existing directory or symlink.
  const result = await directory(output); assert.equal(result.dev, String(info.dev)); return result;
}
async function modules(input) {
  const verified = await verifyBackendArtifact({ directory: input.installationDirectory, artifact: backend });
  assert.equal(verified.manifest.sourceRepository, input.repository);
  assert.equal(verified.root, join(input.installationDirectory, 'backend-artifacts', backend.artifactId, 'root'));
  const at = name => import(pathToFileURL(join(verified.root, 'tools/personal-preview', name)).href);
  return { preview: await at('preview.mjs'), process: await at('process.mjs'), web: await at('web-release.mjs'),
    artifact: await at('web-artifact.mjs'), policy: await at('web-retention-policy.mjs'), diagnostics: await at('startup-diagnostics.mjs'),
    maintenance: await at('maintenance-host.mjs'), renameExclusive,
    // Resolve the same public serializer as this verified artifact's maintenance producer.
    canonical: (await import(pathToFileURL(join(verified.root, 'apps/server/src/database.ts')).href)).canonical };
}
async function observe(input, mod) {
  await observeCurrentInstallation(mod, input);
  const state = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
  const op = await mod.preview.readPreviewJson(join(input.installationDirectory, 'maintenance.json'));
  assert.equal(sha(mod.canonical(state)), mod.recovery.stateDigest, 'RECOVERED_LAUNCH_CHANGED');
  assert.equal(sha(mod.canonical(op)), mod.recovery.operationDigest, 'RECOVERED_OPERATION_CHANGED');
  assert.equal(op.operationId, operationId); assert.equal(op.phase, 'resumed'); assert.deepEqual(op.backendArtifact, backend);
  const view = await mod.maintenance.maintainPreview({ directory: input.installationDirectory, action: 'status' });
  assert.equal(view.state, 'accepting'); assert.equal(view.version, 24); assert.equal(view.operationId, null); assert.equal(view.runnerId, runnerId);
  assert.equal(await mod.diagnostics.readRunnerInitialization({ directory: input.installationDirectory, recordKey: 'runner', record: state.processes.runner, runnerId }), true);
  assert.deepEqual(await mod.web.readWebRelease(input.installationDirectory), input.expectedRelease);
  for (const item of [...input.retainedArtifacts, artifact]) await mod.web.verifyWebCompatibility({ directory: input.installationDirectory, artifact: item,
    backendHead: backend.sourceHead, compatibilityId: reports[item.artifactId], expectedContext: context });
  return state;
}
export function assertPublished(input, result, before, after) {
  assert.equal(result.web, 'ready'); assert.equal(result.release.version, 4); assert.equal(result.release.current, artifact.artifactId);
  assert.deepEqual(result.release.artifacts, [...input.retainedArtifacts, artifact]); assert.deepEqual(result.release.compatibilityIds, reports);
  const stable = value => { const copy = structuredClone(value); delete copy.webReleaseOperation; return copy; };
  assert.deepEqual(stable(after), stable(before), 'WEB_ONLY_STATE_CHANGED');
}
/** The function port is in-process test composition only; JSON cannot supply code. */
export async function publish(input, mod) {
  const completed = await json(join(input.runDirectory, 'complete.json'));
  assert.equal(completed.outcome, 'web-artifact-imported-pointer-unchanged'); assert.deepEqual(completed.artifact, artifact);
  const before = await observe(input, mod);
  const result = await mod.preview.publishPreviewWeb({ directory: input.installationDirectory, artifact, expectedVersion: 3,
    expectedBackendHead: backend.sourceHead, compatibilityId: reports[artifact.artifactId] });
  const after = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
  assertPublished(input, result, before, after);
  for (const name of files.slice(0, 4)) {
    const pin = input.privateFiles[name], value = await privateBytes(join(input.installationDirectory, name), pin.bytes);
    assert.equal(value.bytes.length, pin.bytes); assert.equal(sha(value.bytes), pin.sha256);
    assert.equal(String(value.info.dev), pin.dev); assert.equal(String(value.info.ino), pin.ino);
  }
  for (const role of roles) assert.equal(await mod.process.inspectOwnedProcess(after.processes[role]), 'running');
  return { outcome: 'web-published-confirmed', release: result.release, processRecordsPreserved: true, actualClaim: 'NOT_OBSERVED' };
}
export async function runWebOnly(input, action) {
  validateInput(input); assert.ok(['transfer', 'publish'].includes(action));
  const receipt = await privateBytes(input.finalReceipt.path, input.finalReceipt.bytes);
  assert.equal(receipt.bytes.length, input.finalReceipt.bytes); assert.equal(sha(receipt.bytes), input.finalReceipt.sha256);
  const recovery = JSON.parse(receipt.bytes); assertRecoveryReceipt(recovery);
  const output = action === 'transfer' ? input.runDirectory : input.publicationDirectory;
  const runIdentity = await createOutputDirectory(output);
  await record(join(output, 'web-only-intent.json'), { at: new Date().toISOString(), action, artifact, backend });
  try {
    const mod = await modules(input); mod.recovery = recovery; mod.observe = () => observe(input, mod);
    const result = action === 'transfer' ? await transferWebArtifact({ ...input, runIdentity }, mod) : await publish(input, mod);
    await record(join(output, 'web-only-result.json'), result); return result;
  } catch (error) {
    await record(join(output, 'web-only-failure.json'), { outcome: 'UNKNOWN_KEEP_NO_RETRY', action,
      code: /^[A-Z0-9_]{1,64}$/.test(error.code ?? '') ? error.code : null, publicationMayHaveCommitted: action === 'publish' }).catch(() => {});
    throw error;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const [action, path, digest, ...extra] = process.argv.slice(2); assert.equal(extra.length, 0);
    console.log(JSON.stringify(await runWebOnly(await readInstance(path, digest), action))); }
  catch (error) { console.error(JSON.stringify({ outcome: 'UNKNOWN_KEEP_NO_RETRY', code: /^[A-Z0-9_]{1,64}$/.test(error.code ?? '') ? error.code : null })); process.exitCode = 1; }
}
