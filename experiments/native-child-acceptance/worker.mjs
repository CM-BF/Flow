import { readFile, writeFile } from 'node:fs/promises';
import { openSync, writeFileSync, closeSync, fsyncSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';
import { guardExecutionProfile } from '../../apps/runner/src/execution-profiles.ts';
import { runRunner } from '../../apps/runner/src/runtime.ts';
import { recordHostDecisions } from '../native-graph-acceptance/guard.mjs';
import { adapterOptions, sourceIdentity, MATERIAL, SYNTHETIC_FINAL, MANAGED_BASELINE } from './config.mjs';
import { queryGate, observeFrame, validatePermit } from './guard.mjs';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
const report = { mode: config.mode, scenario: config.scenario, pid: process.pid, nativeQueryCalls: 0, queryAdapterCalls: 0, queryClosed: false, notices: [], readObservations: [] };
const stop = new AbortController();
process.once('SIGTERM', () => stop.abort()); process.once('SIGINT', () => stop.abort());
async function* injected(input) {
  const session = randomUUID(), useId = randomUUID();
  yield { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: session, model: 'synthetic-effective', permissionMode: 'dontAsk', tools: config.scenario === 'init-difference' ? ['Read', 'Bash'] : ['Read'],
    plugins: MANAGED_BASELINE.plugins.map(name => ({ name, version: 'synthetic' })), skills: MANAGED_BASELINE.skills, mcp_servers: [], claude_code_version: 'synthetic-no-provider' };
  const snapshot = input.prompt.split('\n').find(line => line.startsWith('Authorized material: '))?.slice('Authorized material: '.length);
  const hook = input.options.hooks.PreToolUse[0].hooks[0];
  const hookInput = { hook_event_name: 'PreToolUse', session_id: session, transcript_path: 'synthetic', cwd: input.options.cwd, tool_use_id: useId,
    tool_name: config.scenario === 'denied-tool' ? 'Bash' : 'Read', tool_input: { file_path: snapshot } };
  const allowed = await hook(hookInput, undefined, { signal: input.options.abortController.signal });
  if (config.scenario !== 'allow-without-read' && allowed.hookSpecificOutput.permissionDecision === 'allow') {
    const text = await readFile(snapshot, 'utf8');
    if (text !== MATERIAL) throw new Error('Synthetic snapshot mismatch');
    yield { type: 'assistant', parent_tool_use_id: null, uuid: randomUUID(), session_id: session,
      message: { id: 'synthetic-message', role: 'assistant', content: [{ type: 'tool_use', id: useId, name: 'Read', input: { file_path: snapshot } }] } };
    yield { type: 'user', parent_tool_use_id: null, uuid: randomUUID(), session_id: session,
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: useId, content: text, is_error: false }] } };
  }
  yield { type: 'result', subtype: 'success', is_error: config.scenario === 'error-result', uuid: randomUUID(), session_id: session,
    result: SYNTHETIC_FINAL, modelUsage: {}, permission_denials: config.scenario === 'denied-tool' ? [{ tool_name: 'Bash', tool_use_id: useId, tool_input: { private: 'omitted' } }] : [], num_turns: 2, total_cost_usd: 0 };
}
try {
  const identity = await sourceIdentity();
  if (identity.digest !== config.sourceDigest) throw new Error('Source changed before worker start');
  let nativeQuery;
  if (config.mode === 'native') {
    validatePermit(config.permit, identity);
    const require = createRequire(new URL('../../apps/runner/package.json', import.meta.url));
    ({ query: nativeQuery } = await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href));
  } else if (config.mode !== 'rehearsal') throw new Error('Unknown execution mode');
  const query = input => {
    queryGate(config.mode, input, report); recordHostDecisions(input, report);
    let original;
    if (config.mode === 'native') {
      validatePermit(config.permit, identity);
      const marker = openSync(config.marker + '.query-started', 'wx', 0o600);
      try { writeFileSync(marker, JSON.stringify({ approvalId: config.permit.approvalId, sourceDigest: identity.digest, startedAt: new Date().toISOString(), outcome: 'unknown' }) + '\n'); fsyncSync(marker); }
      finally { closeSync(marker); }
      report.nativeQueryCalls++; original = nativeQuery(input);
    } else original = Object.assign(injected(input), { close() {} });
    return Object.assign((async function* () { for await (const frame of original) { observeFrame(frame, report); yield frame; } })(),
      { close() { report.queryClosed = true; original.close(); } });
  };
  const options = { ...adapterOptions(config.mode, config.materialFile), query };
  report.configuredTimeoutMs = options.timeoutMs;
  await runRunner({ baseUrl: config.baseUrl, token: config.runnerToken, workingDirectory: config.workingDirectory, signal: stop.signal,
    adapters: [guardExecutionProfile(createClaudeAdapter(options), config.profile.reference, config.profile.configuration)],
    pollIntervalMs: 30, heartbeatIntervalMs: 300, onNotice: notice => { if (report.notices.length < 32) report.notices.push(notice); } });
} catch { report.error = 'Runner preparation or execution failed; do not retry a native approval.'; process.exitCode = 1; }
finally { await writeFile(config.reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); }
