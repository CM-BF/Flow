/** Narrow preparation step after an independently recorded durable drain; never resumes/restarts. */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { source, sha, readRegular } from './retire.mjs';
import { snapshot, durable } from '../center-recovery/facts.mjs';

const repository = '/Users/citrine/Projects/AgentHarness/Flow', personal = '/Users/citrine/.flow-personal';
const execute = promisify(execFile);
const fail = code => { throw Object.assign(Error(code), { code }); };
export async function holdAndStopRunner(request, output) {
  if (request.runnerId !== 'd22f4df2-8242-49f4-a1b4-77f8f08611ef' || request.source !== source
    || !Number.isSafeInteger(request.drainVersion) || request.drainVersion < 1 || !request.operationId) fail('FIXED_OPERATION_REQUIRED');
  const current = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'], { timeout: 1500 })).stdout.trim();
  if (current !== source || (await execute('git', ['-C', repository, 'status', '--porcelain'], { timeout: 1500 })).stdout) fail('SOURCE_CHANGED');
  const preview = await import(pathToFileURL(join(repository, 'tools/personal-preview/preview.mjs')).href);
  const processTools = await import(pathToFileURL(join(repository, 'tools/personal-preview/process.mjs')).href);
  const maintenance = await import(pathToFileURL(join(repository, 'apps/server/src/runner-maintenance/index.ts')).href);
  const config = await preview.loadPreviewConfiguration(personal);
  return preview.withPreviewLock(config, async () => {
    const before = await snapshot();
    if (before.source.head !== source || before.source.dirty || !before.database.markerMatched || !before.database.runnerIdentityMatched
      || before.identity.runnerId !== request.runnerId || before.database.unfinished.length || before.database.uncertain.length
      || before.database.tasks.some(t => !['succeeded', 'failed', 'cancelled'].includes(t.status))
      || before.database.queue.some(row => row.state === 'waiting' && row.count > 0)
      || Object.values(before.processes).some(p => p.identity !== 'running')) fail('FRESH_HOLD_GATE');
    const stateBytes = (await readRegular(join(personal, 'state.json'))).bytes, state = JSON.parse(stateBytes);
    const local = JSON.parse((await readRegular(join(personal, 'maintenance.json'))).bytes);
    const row = before.database.runner[0];
    if (before.database.runner.length !== 1 || row.maintenance_state !== 'draining' || row.maintenance_version !== request.drainVersion
      || row.maintenance_operation_id !== request.operationId || local.operationId !== request.operationId || !local.holdKey) fail('HOLD_OPERATION');
    await durable(join(output, 'before.json'), before);
    await durable(join(output, 'intent.json'), { kind: 'same-operation-hold-and-owned-runner-stop', source,
      operationId: request.operationId, drainVersion: request.drainVersion, runnerId: request.runnerId, stateSha256: sha(stateBytes) });
    const { Pool } = createRequire(join(repository, 'package.json'))('pg');
    const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000 });
    let receipt;
    try {
      receipt = await maintenance.commandRunnerMaintenance(pool, request.runnerId, 'hold', { version: request.drainVersion,
        operationId: request.operationId, reason: 'No active attempts; reserve the local update.' }, local.holdKey, 'trusted-host');
      await durable(join(output, 'hold.json'), receipt);
    } finally { await pool.end(); }
    if (sha((await readRegular(join(personal, 'state.json'))).bytes) !== sha(stateBytes)
      || sha((await readRegular(join(personal, 'config.json'))).bytes) !== before.files['config.json'].sha256) fail('STATE_CHANGED');
    // The reviewed helper sends TERM only to its positively identified group; never force/KILL.
    const stopped = await processTools.stopOwnedProcess(state.processes.runner);
    const confirmed = await processTools.inspectOwnedProcess(state.processes.runner);
    const result = { outcome: stopped === 'stopped' && confirmed === 'stopped' ? 'held-runner-stopped' : 'unknown', stopped, confirmed,
      hold: receipt.state, stateSha256: sha(stateBytes), runnerRecordSha256: sha(JSON.stringify(state.processes.runner)), otherRoleSignals: 0 };
    await durable(join(output, 'result.json'), result);
    return result;
  });
}
