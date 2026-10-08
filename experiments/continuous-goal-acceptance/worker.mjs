import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { createPrivateErrorRecorder } from './error-diagnostics.mjs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { NativeExecutionError } from '../../apps/runner/src/native-harness/settlement.ts';
import { adapterOptions } from './config.mjs';
import { readRecord, writeRecord } from './records.mjs';
import { sourceIdentity, RESERVATIONS } from './identity.mjs';
import { validatePermit, openReservedPhase } from './permit.mjs';
import { createObservedQuery } from './query-run.mjs';
import { bindPlannerAssignment, bindChildAssignment } from './assignment.mjs';
import { assertNativeReady } from './stage-policy.mjs';
import { nativeEnvironmentPolicy } from './native-environment.mjs';

const config = await readRecord(process.argv[2]), identity = await sourceIdentity();
assert.equal(config.sourceDigest, identity.digest); assert(['plan', 'children'].includes(config.phase));
assert(['native', 'rehearsal'].includes(config.mode)); assert(process.send);
// The native branch verifies fixed inputs and the new handoff before importing SDK code.
const report = { phase: config.phase, mode: config.mode, pid: process.pid, sourceDigest: identity.digest,
  nativeQueryCalls: 0, queries: [], notices: [], outcome: 'unknown' };
const stop = new AbortController();
process.once('SIGTERM', () => stop.abort()); process.once('SIGINT', () => stop.abort());
let reservation, nativeQuery, rehearseQuery, activeBinding;
if (config.mode === 'native') {
  const permit = validatePermit(config.permit, { identity, phase: config.phase, confirmation: config.confirmation,
    executionAuthorization: config.executionAuthorization, environmentDigest: nativeEnvironmentPolicy.digest });
  if (config.executionAuthorization) assert(config.expected.progressionId === config.executionAuthorization.progressionId
    && config.expected.authorizationDigest === config.executionAuthorization.authorizationDigest);
  assertNativeReady(config.mode, permit, nativeEnvironmentPolicy.digest);
  await nativeEnvironmentPolicy.verify(config.nativeEnvironment, identity);
  for (const [key, value] of Object.entries(nativeEnvironmentPolicy.environment(config.nativeEnvironment))) assert.equal(process.env[key], value);
  assert(!Object.keys(process.env).some(key => /^(ANTHROPIC_|DEBUG|CLAUDE_CODE_OAUTH_TOKEN|FLOW_)/.test(key)));
  reservation = await openReservedPhase(RESERVATIONS, permit);
  const require = createRequire(new URL('../../apps/runner/package.json', import.meta.url));
  const sdk = require.resolve('@anthropic-ai/claude-agent-sdk');
  assert.equal(sdk, nativeEnvironmentPolicy.recipe.files[1].path);
  ({ query: nativeQuery } = await import(pathToFileURL(sdk).href));
} else {
  const { rehearsalQuery } = await import('./rehearsal.mjs'); rehearseQuery = rehearsalQuery(config.phase, config.citation);
}
// These existing adapters also import SDK JavaScript: defer them until the native input guard has completed.
const { createClaudeAdapter } = await import('../../apps/runner/src/claude.ts');
const { guardExecutionProfile } = await import('../../apps/runner/src/execution-profiles.ts');
const { runRunner } = await import('../../apps/runner/src/runtime.ts');
let requests = 0;
function currentBinding(actual, selected) {
  assert(++requests <= 2);
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const finish = (error, value) => { clearTimeout(timer); process.off('message', received); stop.signal.removeEventListener('abort', aborted); error ? reject(error) : resolve(value); };
    const aborted = () => finish(new Error('Binding observation aborted.'));
    const received = message => {
      if (message?.id !== id) return;
      try { assert(Buffer.byteLength(JSON.stringify(message)) <= 65_536 && message.kind === 'bound-observation');
        finish(null, bindChildAssignment(config.expected, message.current, actual, selected)); }
      catch { finish(new Error('Public binding observation was rejected.')); }
    };
    const timer = setTimeout(() => finish(new Error('Public binding observation expired.')), 5000);
    process.on('message', received); stop.signal.addEventListener('abort', aborted, { once: true });
    if (stop.signal.aborted) return aborted();
    process.send({ kind: 'observe-assignment', id, assignment: actual }, error => { if (error) finish(error); });
  });
}
const recordError = await createPrivateErrorRecorder({ directory: dirname(config.reportFile), sourceDigest: identity.digest,
  phase: config.phase, secrets: [config.runnerToken] });
const query = createObservedQuery({ mode: config.mode, phase: config.phase, reservation, getBinding: () => activeBinding,
  nativeQuery, rehearseQuery, report, recordError, persistObservation: () => writeRecord(config.reportFile, report), nativeEnvironment: config.mode === 'native'
    ? { policy: nativeEnvironmentPolicy, binding: config.nativeEnvironment, source: identity } : undefined });
try {
  const options = { ...adapterOptions(config.mode, config.phase, config.materialFile), query }, original = createClaudeAdapter(options);
  const adapter = { name: original.name, version: original.version, async run(context) {
    assert(!activeBinding && Object.isFrozen(context.executionIdentity)); await context.assertOwnership();
    activeBinding = config.phase === 'plan'
      ? bindPlannerAssignment(config.admitted, context.executionIdentity, context.goalGraphTools, context.task.executionProfile)
      : await currentBinding(context.executionIdentity, context.task.executionProfile);
    try { await context.assertOwnership(); await original.run(context); }
    catch (error) {
      // close() has no exit receipt. No uncertain native entry becomes an ordinary settled failure.
      if (config.mode === 'native' && report.queries.some(row => row.binding.assignment.taskId === activeBinding.assignment.taskId && row.entry !== 'not-started')) throw new NativeExecutionError('unknown');
      throw error;
    } finally { activeBinding = undefined; await writeRecord(config.reportFile, report); }
  } };
  await runRunner({ baseUrl: config.baseUrl, token: config.runnerToken, workingDirectory: config.workingDirectory,
    signal: stop.signal, adapters: [guardExecutionProfile(adapter, config.profile.reference, config.profile.configuration)],
    pollIntervalMs: 30, heartbeatIntervalMs: 300, requestTimeoutMs: 5000,
    onNotice(notice) { if (report.notices.length < 64) report.notices.push(notice); } });
  report.outcome = 'runtime-returned';
} catch { report.failure = 'runner-or-evidence-unconfirmed'; process.exitCode = 1; }
finally { await writeRecord(config.reportFile, report); process.disconnect?.(); }
