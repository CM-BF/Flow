import { open, readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';
import { LIMITS } from './config.mjs';

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
    report.effective = { model: event.model ?? null, permissionMode: event.permissionMode ?? null, tools: event.tools ?? null,
      plugins: event.plugins ?? null, skills: event.skills ?? null, mcpServers: event.mcp_servers ?? null,
      runtimeVersion: event.claude_code_version ?? null, nativeSessionId: event.session_id, advertisedAgents: event.agents ?? null };
    if (report.mode === 'native' && (!Array.isArray(event.tools) || !Array.isArray(event.plugins) || !Array.isArray(event.skills)
      || !Array.isArray(event.mcp_servers) || event.mcp_servers.length !== 1 || event.mcp_servers[0].name !== 'flow-graph'
      || event.mcp_servers[0].status !== 'connected' || event.mcp_servers[0].source !== 'sdk'
      || JSON.stringify([...event.tools].sort()) !== JSON.stringify(['mcp__flow-graph__graph_command', 'mcp__flow-graph__graph_read'])
      || event.permissionMode !== 'dontAsk' || typeof event.model !== 'string')) throw new Error('Native capability observations are incomplete or different');
    if (event.plugins?.length || event.skills?.length || event.tools?.some(name => !['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command'].includes(name))) throw new Error('Unexpected effective extensions/tools');
  }
  if (event.type === 'result') {
    report.result = { subtype: event.subtype, isError: event.is_error, numTurns: event.num_turns ?? null,
      sdkEstimatedCostUsd: event.total_cost_usd ?? null, nativeSessionId: event.session_id, modelUsage: event.modelUsage ?? null };
    if (report.mode === 'native' && (!Number.isInteger(event.num_turns) || event.num_turns > LIMITS.maxTurns
      || !Number.isFinite(event.total_cost_usd) || event.total_cost_usd < 0 || event.total_cost_usd > LIMITS.maxBudgetUsd)) throw new Error('Native result exceeds or cannot prove the approved accounting limits');
  }
}
