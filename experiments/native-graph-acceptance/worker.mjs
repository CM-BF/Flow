import { readFile, writeFile } from 'node:fs/promises';
import { openSync, writeFileSync, closeSync, fsyncSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { guardExecutionProfile } from '../../apps/runner/src/execution-profiles.ts';
import { runRunner } from '../../apps/runner/src/runtime.ts';
import { adapterOptions, sourceIdentity } from './config.mjs';
import { queryGate, observeFrame, validatePermit, recordHostDecisions } from './guard.mjs';
import { rehearseQuery } from './peer.mjs';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
const report = { mode: config.mode, pid: process.pid, nativeQueryCalls: 0, queryAdapterCalls: 0, queryClosed: false,
  requested: null, effective: null, result: null, wire: [], notices: [] };
const stop = new AbortController();
process.once('SIGTERM', () => stop.abort()); process.once('SIGINT', () => stop.abort());
const identity = await sourceIdentity();
if (identity.digest !== config.sourceDigest) throw new Error('Source changed before worker start');
let nativeQuery;
if (config.mode === 'native') {
  validatePermit(config.permit, identity);
  const require = createRequire(new URL('../../apps/runner/package.json', import.meta.url));
  ({ query: nativeQuery } = await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href));
} else if (config.mode !== 'rehearsal') throw new Error('Unknown execution mode');
const gate = queryGate(config.mode, report);
const query = input => {
  gate(input);
  recordHostDecisions(input, report);
  let original;
  if (config.mode === 'native') {
    validatePermit(config.permit, identity);
    const marker = openSync(config.marker + '.query-started', 'wx', 0o600);
    try { writeFileSync(marker, JSON.stringify({ approvalId: config.permit.approvalId, sourceDigest: identity.digest, startedAt: new Date().toISOString(), outcome: 'unknown' }) + '\n'); fsyncSync(marker); }
    finally { closeSync(marker); }
    report.nativeQueryCalls++;
    original = nativeQuery(input);
  } else {
    original = Object.assign((async function* () {
      await rehearseQuery(input, report);
      yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: 'o08-synthetic-session',
        result: '已记录起草→核对→交付三个步骤的计划；尚未执行子任务。', modelUsage: {}, permission_denials: [] };
    })(), { close() {} });
  }
  return Object.assign((async function* () {
    for await (const event of original) { observeFrame(event, report); yield event; }
  })(), { close() { report.queryClosed = true; original.close(); } });
};
try {
  const options = { ...adapterOptions(config.mode), query };
  report.configuredTimeoutMs = options.timeoutMs;
  const adapter = createClaudeAdapter(options);
  await runRunner({ baseUrl: config.baseUrl, token: config.runnerToken, workingDirectory: config.workingDirectory,
    signal: stop.signal, adapters: [guardExecutionProfile(adapter, config.profile.reference, config.profile.configuration)],
    pollIntervalMs: 30, heartbeatIntervalMs: 300, onNotice: notice => report.notices.push(notice) });
} catch { report.error = 'Runner preparation or execution failed; inspect center facts without retrying.'; process.exitCode = 1; }
finally { await writeFile(config.reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); }
