import { open, readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';
import { LIMITS, EXPECTED_TOOLS, MANAGED_BASELINE } from './config.mjs';

/** This record is an operator handoff of fresh human authorization, not a cryptographic proof of consent. */
export function validatePermit(value, identity, now = Date.now()) {
  if (!value || value.kind !== 'flow-o08-one-shot' || value.authorizedBy !== 'Goal Owner'
    || typeof value.approvalId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(value.approvalId)
    || value.sourceDigest !== identity.digest || value.worktree !== identity.root || value.model !== 'sonnet'
    || JSON.stringify(value.limits) !== JSON.stringify(LIMITS)
    || typeof value.authorizationReference !== 'string' || value.authorizationReference.trim().length < 10
    || !Number.isFinite(Date.parse(value.approvedAt)) || !Number.isFinite(Date.parse(value.expiresAt))
    || Date.parse(value.approvedAt) > now || Date.parse(value.expiresAt) <= now
    || Date.parse(value.expiresAt) - Date.parse(value.approvedAt) > 86_400_000) {
    throw new Error('Fresh matching Goal Owner one-shot authorization is required');
  }
  return value;
}
export async function reserveAttempt(permitPath, identity, markerRoot = new URL('../../docs/evidence/o08/attempts/', import.meta.url)) {
  const file = resolve(permitPath);
  if ((await stat(file)).size > 8192) throw new Error('Authorization record too large');
  const permit = validatePermit(JSON.parse(await readFile(file, 'utf8')), identity);
  // A fixed durable directory prevents a moved permit/output path from consuming the approval again.
  const directory = markerRoot instanceof URL ? fileURLToPath(markerRoot) : resolve(markerRoot);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const marker = resolve(directory, `o08-attempt-${permit.approvalId}.json`);
  const handle = await open(marker, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify({ approvalId: permit.approvalId, sourceDigest: identity.digest,
    reservedAt: new Date().toISOString(), outcome: 'unknown', permitFile: basename(file) }) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  return { permit, marker };
}
export function queryGate(mode, report) {
  return input => {
    report.queryAdapterCalls++;
    if (report.queryAdapterCalls !== 1) throw new Error('The single query attempt is already consumed');
    const options = input.options;
    if (!options || options.maxTurns !== LIMITS.maxTurns || options.maxBudgetUsd !== LIMITS.maxBudgetUsd
      || options.model !== (mode === 'native' ? 'sonnet' : 'synthetic-no-query')) throw new Error('Query budget or profile mismatch');
    const names = [...(options.allowedTools ?? [])].sort();
    if (JSON.stringify(names) !== JSON.stringify(['mcp__flow-graph__graph_command', 'mcp__flow-graph__graph_read'])
      || options.tools.length !== 0 || options.settingSources.length !== 0 || options.plugins.length !== 0 || options.skills.length !== 0
      || Object.keys(options.mcpServers).join() !== 'flow-graph' || options.mcpServers['flow-graph'].type !== 'sdk') throw new Error('Unexpected native capabilities');
    report.requested = { model: options.model, maxTurns: options.maxTurns, maxBudgetUsd: options.maxBudgetUsd,
      permissionMode: options.permissionMode, tools: options.tools, allowedTools: names, plugins: options.plugins, skills: options.skills,
      mcp: { key: 'flow-graph', name: options.mcpServers['flow-graph'].name, type: 'sdk' } };

  };
}
export function observeFrame(event, report) {
  if (event.type === 'system' && event.subtype === 'init') {
    // This is SDK-declared metadata, never evidence of actual tool execution or hook isolation.
    report.effective = { model: event.model ?? null, permissionMode: event.permissionMode ?? null, tools: event.tools ?? null,
      plugins: event.plugins?.slice(0, 16).map(plugin => ({ name: label(plugin.name), version: label(plugin.version) })) ?? null,
      skills: event.skills ?? null, mcpServers: event.mcp_servers ?? null, observationKind: 'sdk-init-declaration',
      runtimeVersion: event.claude_code_version ?? null, nativeSessionId: event.session_id, advertisedAgents: event.agents ?? null };
    if (report.mode === 'native' && (!Array.isArray(event.tools) || !Array.isArray(event.plugins) || !Array.isArray(event.skills)
      || !Array.isArray(event.mcp_servers) || event.mcp_servers.length !== 1 || event.mcp_servers[0].name !== 'flow-graph'
      || event.mcp_servers[0].status !== 'connected' || event.mcp_servers[0].source !== 'sdk'
      || !exactNames(event.tools, EXPECTED_TOOLS) || !exactNames(event.plugins.map(plugin => plugin.name), MANAGED_BASELINE.plugins)
      || !exactNames(event.skills, MANAGED_BASELINE.skills)
      || event.permissionMode !== 'dontAsk' || typeof event.model !== 'string')) throw new Error('Native capability observations are incomplete or different');
    if (event.tools?.some(name => !EXPECTED_TOOLS.includes(name))) throw new Error('Unexpected effective tools');
  }
  if (event.type === 'result') {
    report.permissionDenials = { source: 'result.permission_denials', state: Array.isArray(event.permission_denials) ? 'reported' : 'unknown',
      total: Array.isArray(event.permission_denials) ? event.permission_denials.length : null,
      entries: event.permission_denials?.slice(0, 32).map(denial => ({ toolName: label(denial.tool_name), toolUseId: label(denial.tool_use_id) })) ?? [],
      parametersOmitted: true, truncated: (event.permission_denials?.length ?? 0) > 32 };
    report.result = { subtype: event.subtype, isError: event.is_error, numTurns: event.num_turns ?? null,
      sdkEstimatedCostUsd: event.total_cost_usd ?? null, nativeSessionId: event.session_id, modelUsage: event.modelUsage ?? null };
    if (report.mode === 'native' && (!Number.isInteger(event.num_turns) || event.num_turns > LIMITS.maxTurns
      || !Number.isFinite(event.total_cost_usd) || event.total_cost_usd < 0 || event.total_cost_usd > LIMITS.maxBudgetUsd)) throw new Error('Native result exceeds or cannot prove the approved accounting limits');
  }
}
function exactNames(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length
    && actual.every(name => typeof name === 'string' && expected.includes(name));
}
function label(value) { return typeof value === 'string' && value.length <= 160 ? value : null; }

/** Observe the existing host gate without adding any authority or persisting tool parameters. */
export function recordHostDecisions(input, report) {
  const matchers = input.options.hooks?.PreToolUse;
  if (!Array.isArray(matchers) || matchers.length !== 1 || matchers[0].hooks?.length !== 1) throw new Error('Unknown host gate configuration');
  const original = matchers[0].hooks[0];
  report.hostToolDecisions = [];
  matchers[0].hooks[0] = async (...args) => {
    if (report.hostToolDecisions.length >= 64) { input.options.abortController.abort(); throw new Error('Host decision observation limit reached'); }
    const event = args[0];
    const row = { toolName: label(event.tool_name), source: label(event.mcp_server?.source), server: label(event.mcp_server?.name),
      toolUseId: label(event.tool_use_id), decision: 'unknown', execution: 'not-observed' };
    report.hostToolDecisions.push(row);
    try {
      const result = await original(...args);
      const value = result?.hookSpecificOutput?.permissionDecision;
      row.decision = value === 'allow' ? 'allowed' : value === 'deny' ? 'denied' : 'unknown';
      if (row.decision === 'unknown') throw new Error('Host decision unknown');
      return result;
    } catch { input.options.abortController.abort(); throw new Error('Host tool authority could not be observed'); }
  };
}
