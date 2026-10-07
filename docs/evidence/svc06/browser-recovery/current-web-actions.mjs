/** Fixed public report/publish calls. Backend maintenance retains its separate three-report contract. */
import assert from 'node:assert/strict';
import { mkdir, lstat, realpath } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyBackendArtifact } from '../../../../tools/personal-preview/backend-release/index.mjs';
import { record } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';
import { boundedFile } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/artifact-transfer/import-d629.mjs';
import { readInstance } from './current-import.mjs';
import { validatePlan } from './current-maintenance.mjs';
import { observeCurrentInstallation } from './current-migration.mjs';
import { validateWebTransferInput } from './current-web-transfer.mjs';
import { privateBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';

const source = '04da80692e79e2b7c3f6341c7fa76515a3f719a3';
const web = '779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4';
const reports = ['fc5cf4912f24af8ed476b972b7cfdb21403abb59f3576bdfd3fed24e5d77eced',
  '15350e797fd6bffd32a34e7fb9b28a8e546cc020a1a65168348220310a056251',
  '366c4a4225d4e3ea334ea7788b67fa45f7928a36614d3e858d565187b4dacfb6',
  '071d928d67f93e59b0e05a20280cda5a6d3d9249ec7428a61484c804e56179f7'];
const producer = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-recovery/docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-third/raw/fixture/compatibility-state/web-compatibility';
const sha = value => createHash('sha256').update(value).digest('hex');
export const webActions = Object.freeze(['import-retained-reports', 'import-new-report', 'publish-web']);

export function webActionParameters(plan, action) {
  assert.ok(webActions.includes(action)); validatePlan(plan);
  assert.deepEqual(plan.reportIds, reports.slice(0, 3));
  const value = plan.webPublication;
  assert.deepEqual(value.reportDirectories, reports.map(id => join(producer, id)));
  assert.deepEqual(value.request, { artifact: { artifactId: web, manifestDigest: web, sourceHead: 'c2311b6bd44a2a8e73e3b066be5f12bc8b153b37' },
    expectedVersion: 3, expectedBackendHead: source, compatibilityId: reports[3] });
  const output = value.actions[action];
  assert.ok(isAbsolute(output.directory) && output.directory.startsWith('/private/tmp/flow-svc06b-'));
  assert.ok(isAbsolute(output.outer)); assert.notEqual(output.directory, plan.runDirectory);
  return { artifact: action === 'import-retained-reports' ? plan.migration.expectedBackendArtifact : plan.migration.artifact,
    reports: action === 'import-retained-reports' ? reports.slice(0, 3) : action === 'import-new-report' ? reports.slice(3) : [], output };
}

async function safeDirectory(path) {
  const info = await lstat(path);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
  assert.equal(await realpath(path), path);
}
async function json(path) { return JSON.parse((await privateBytes(path, 65536)).bytes); }
async function modules(plan, artifact) {
  const result = await verifyBackendArtifact({ directory: plan.migration.installationDirectory, artifact });
  assert.equal(result.manifest.sourceRepository, plan.migration.repository);
  const at = name => import(pathToFileURL(join(result.root, 'tools/personal-preview', name)).href);
  return { preview: await at('preview.mjs'), process: await at('process.mjs'), web: await at('web-release.mjs') };
}
async function beforeWeb(plan, mod) {
  const input = await readInstance(plan.webPublication.transferInput.path, plan.webPublication.transferInput.sha256);
  validateWebTransferInput(input);
  const final = JSON.parse(await boundedFile(input.finalReceipt.path, input.finalReceipt.bytes, input.finalReceipt.sha256));
  assert.equal(final.outcome, 'resumed-confirmed'); assert.deepEqual(final.runtimeSource, { head: source, dirty: false });
  const op = await mod.preview.readPreviewJson(join(input.installationDirectory, 'maintenance.json'));
  assert.equal(op.phase, 'resumed'); assert.equal(op.operationId, final.operationId); assert.deepEqual(op.backendArtifact, plan.migration.artifact);
  await observeCurrentInstallation(mod, input);
  assert.deepEqual(await mod.web.readWebRelease(input.installationDirectory), input.expectedRelease);
  return input;
}
async function importReports(plan, mod, ids, output) {
  for (const id of ids) {
    await boundedFile(join(producer, id, 'report.json'), 791, id);
    const result = await mod.preview.importPreviewCompatibility({ directory: plan.migration.installationDirectory, reportDirectory: join(producer, id) });
    assert.equal(result.compatibilityId, id);
    await record(join(output, id + '.json'), { compatibilityId: id });
  }
  return { outcome: 'fixed-reports-imported', compatibilityIds: ids };
}

export async function runWebAction(plan, action) {
  const fixed = webActionParameters(plan, action);
  await safeDirectory(dirname(fixed.output.directory));
  await mkdir(fixed.output.directory, { mode: 0o700 }); // Consumed directories can never be replayed.
  await safeDirectory(fixed.output.directory);
  await record(join(fixed.output.directory, 'intent.json'), { at: new Date().toISOString(), action, artifact: fixed.artifact });
  try {
    const mod = await modules(plan, fixed.artifact);
    let result;
    if (action === 'import-retained-reports') {
      await observeCurrentInstallation(mod, plan.migration);
      result = await importReports(plan, mod, fixed.reports, fixed.output.directory);
      await observeCurrentInstallation(mod, plan.migration);
    } else {
      const input = await beforeWeb(plan, mod);
      if (action === 'import-new-report') result = await importReports(plan, mod, fixed.reports, fixed.output.directory);
      else {
        const completed = await json(join(input.runDirectory, 'complete.json'));
        assert.equal(completed.outcome, 'web-artifact-imported-pointer-unchanged'); assert.deepEqual(completed.artifact, input.artifact);
        const stateBefore = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
        result = await mod.preview.publishPreviewWeb({ directory: input.installationDirectory, ...plan.webPublication.request });
        assert.equal(result.web, 'ready'); assert.equal(result.release.version, 4); assert.equal(result.release.current, web);
        assert.deepEqual(result.release.artifacts, [...input.retainedArtifacts, input.artifact]);
        const stateAfter = await mod.preview.readPreviewJson(join(input.installationDirectory, 'state.json'));
        delete stateBefore.webReleaseOperation; delete stateAfter.webReleaseOperation;
        assert.deepEqual(stateAfter, stateBefore, 'WEB_ONLY_STATE_CHANGED');
        for (const name of ['config.json', 'claude.json', 'browser-session.json', 'maintenance.json']) {
          const pin = input.privateFiles[name], current = await privateBytes(join(input.installationDirectory, name), pin.bytes);
          assert.equal(sha(current.bytes), pin.sha256); assert.equal(String(current.info.dev), pin.dev); assert.equal(String(current.info.ino), pin.ino);
        }
      }
    }
    await record(join(fixed.output.directory, 'result.json'), result); return result;
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'WEB_ACTION_UNCONFIRMED';
    await record(join(fixed.output.directory, 'failure.json'), { action, code, outcome: 'unknown-keep', retry: false }).catch(() => {});
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [action, path, digest, ...extra] = process.argv.slice(2); assert.equal(extra.length, 0);
    console.log(JSON.stringify(await runWebAction(await readInstance(path, digest), action)));
  } catch (error) { console.error(JSON.stringify({ outcome: 'unknown-keep', code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'WEB_ACTION_UNCONFIRMED' })); process.exitCode = 1; }
}
