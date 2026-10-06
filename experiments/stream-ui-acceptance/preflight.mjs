import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareRuntime } from './prepare-runtime.mjs';
import { startFixture } from './fixture.mjs';
import { streamJourney } from './journey.mjs';
import { createCheckpoint, reserveWindow, mutationGuard, promptFor, redactText, sha256 } from './evidence.mjs';

assert.deepEqual(process.argv.slice(2), ['--synthetic'], 'Only explicit synthetic mode is implemented. No live permit is accepted.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const dependencyRoot = resolve(process.env.FLOW_DEPENDENCY_ROOT ?? root);
const runId = `run-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
const runDirectory = `${root}/experiments/stream-ui-acceptance/.runtime/${runId}`;
const output = `${root}/docs/evidence/chatui01/${runId}`;
await mkdir(runDirectory, { recursive: true }); await mkdir(output, { recursive: true });
const nonce = `FLOW_STREAM_${randomUUID()}`, token = 'flow-fixture-only';
const evidence = { kind: 'zero-model actual-App synthetic HTTP rehearsal', startedAt: new Date().toISOString(), sdkQueries: 0, providerRequests: 0,
  realCenter: false, realRunner: false, realModel: false, runId, steps: [], pageErrors: [], network: [], mutations: [], status: 'IN_PROGRESS' };
const checkpoint = createCheckpoint(`${output}/checks.json`, evidence, [token]);
let preview;
try {
  const runtime = await prepareRuntime(dependencyRoot, runDirectory);
  evidence.product = { commit: runtime.productCommit, archiveDigest: runtime.archiveDigest, sourceFiles: runtime.sourceFiles, dependencyRoot };
  const names = (await readdir(`${root}/experiments/stream-ui-acceptance`)).filter(name => name.endsWith('.mjs'));
  evidence.driver = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceFiles: Object.fromEntries(await Promise.all(names.map(async name => [name, sha256(await readFile(`${root}/experiments/stream-ui-acceptance/${name}`))]))) };
  await reserveWindow(`${output}/reservation.json`, { mode: 'synthetic', runId, sdkQueries: 0, sourceDigest: sha256(JSON.stringify(evidence.driver.sourceFiles)), productCommit: runtime.productCommit, at: new Date().toISOString() });
  evidence.reservedAt = new Date().toISOString(); await checkpoint();
  preview = await startFixture({ ...runtime, dependencyRoot, runDirectory });
  evidence.fixture = { webUrl: preview.webUrl, centerUrl: preview.centerUrl, actualApp: true, controls: 'synthetic HTTP only; fixed product archive; dynamic loopback ports' };
  await streamJourney({ webUrl: preview.webUrl, token, nonce, read: preview.read, output, evidence, checkpoint,
    sourceRoot: runtime.sourceRoot, dependencyRoot, profile: preview.profile,
    prepareContext: mutationGuard({ origin: preview.webUrl, evidence, checkpoint, expectedPrompt: promptFor(nonce), expectedCreation: { harness: 'claude', requested: { model: preview.profile.configuration.model, thinking: 'disabled', tools: 'none' }, executionProfile: preview.profile.reference } }),
    afterAcceptance: async ({ conversationId, taskId }) => {
      const turn = preview.fixture.chats.get(conversationId).turns[0]; assert.equal(turn.task.id, taskId);
      preview.stream.seed(turn); preview.stream.append(taskId, '第一段');
    },
    afterSample: async ({ count, taskId }) => {
      if (count === 1) preview.stream.append(taskId, '，第二段');
      if (count === 2) preview.stream.append(taskId, '，第三段。');
      if (count === 3) {
        preview.stream.append(taskId, '', 'block-complete');
        // A second visible block is deliberately retained; the first is replaced by final.
        preview.stream.append(taskId, '保留的工具前说明', 'superseded', 1);
        preview.stream.finish(taskId, `一、准备纸张。\n二、折叠对角。\n三、固定边缘。\n四、完成风筝。\n${nonce}`);
        const metadata = preview.stream.streams.get(taskId).metadata;
        const retained = metadata.blocks.find(block => block.blockIndex === 1).id;
        metadata.settlement.replaceStreamIds = metadata.settlement.replaceStreamIds.filter(id => id !== retained);
        metadata.settlement.retainStreamIds = [retained];
      }
    },
  });
  assert.equal(evidence.incrementalVisible, 'PROVEN');
  assert.equal(evidence.mutations.filter(value => !value.blocked && value.kind === 'create').length, 1);
  assert.equal(evidence.mutations.filter(value => !value.blocked && value.kind === 'turn').length, 1);
  assert.equal(evidence.mutations.some(value => value.blocked), false);
  assert.equal(preview.fixture.requests.some(request => request.path.includes('/details/')), false);
  assert.equal(evidence.final.turnTaskStatus, 'running', 'Typed final is not proof of task terminal.');
  for (const [path, digest] of Object.entries(runtime.sourceFiles)) assert.equal(sha256(await readFile(`${runtime.sourceRoot}/${path}`)), digest, `Frozen source changed during run: ${path}`);
  evidence.product.verifiedUnchangedAfterRun = true;
  evidence.status = 'PASSED_SYNTHETIC_ONLY';
} catch (error) {
  evidence.status = 'FAILED_SYNTHETIC'; evidence.error = redactText(error?.stack ?? error, [token]); process.exitCode = 1;
} finally {
  evidence.beforeFixtureCleanupAt = new Date().toISOString(); await checkpoint();
  await preview?.close(); evidence.fixtureCleanup = 'Own Vite and synthetic HTTP server closed';
  evidence.endedAt = new Date().toISOString(); await checkpoint();
  console.log(JSON.stringify({ status: evidence.status, error: evidence.error, output, sdkQueries: 0, growthSamples: evidence.growthSamples?.length }));
}
