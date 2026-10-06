import { open, readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS, MANAGED_BASELINE, MATERIAL, digest } from './config.mjs';

export function validatePermit(value, identity, now = Date.now()) {
  if (!value || value.kind !== 'flow-o10-one-shot' || value.authorizedBy !== 'Goal Owner'
    || typeof value.approvalId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(value.approvalId)
    || value.sourceDigest !== identity.digest || value.worktree !== identity.root || value.model !== 'sonnet'
    || JSON.stringify(value.limits) !== JSON.stringify(LIMITS)
    || typeof value.authorizationReference !== 'string' || value.authorizationReference.trim().length < 10
    || !Number.isFinite(Date.parse(value.approvedAt)) || !Number.isFinite(Date.parse(value.expiresAt))
    || Date.parse(value.approvedAt) > now || Date.parse(value.expiresAt) <= now
    || Date.parse(value.expiresAt) - Date.parse(value.approvedAt) > 86_400_000) throw new Error('Fresh matching O10 Goal Owner authorization is required');
  return value;
}
// O08's reviewed wx+fsync reservation algorithm, with a distinct task policy and marker directory.
export async function reserveAttempt(path, identity, markerRoot = new URL('../../docs/evidence/o10/attempts/', import.meta.url)) {
  const file = resolve(path);
  if ((await stat(file)).size > 8192) throw new Error('Authorization record too large');
  const permit = validatePermit(JSON.parse(await readFile(file, 'utf8')), identity);
  const directory = markerRoot instanceof URL ? fileURLToPath(markerRoot) : resolve(markerRoot);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const marker = resolve(directory, `o10-attempt-${permit.approvalId}.json`), handle = await open(marker, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify({ approvalId: permit.approvalId, sourceDigest: identity.digest, reservedAt: new Date().toISOString(), outcome: 'unknown', permitFile: basename(file) }) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  return { permit, marker };
}
function exact(actual, expected) { return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length && actual.every(v => typeof v === 'string' && expected.includes(v)); }
function label(value) { return typeof value === 'string' && value.length <= 160 ? value : null; }
export function queryGate(mode, input, report) {
  report.queryAdapterCalls++;
  if (report.queryAdapterCalls !== 1) throw new Error('Only one query entry is allowed');
  const o = input.options;
  if (!o || o.model !== (mode === 'native' ? 'sonnet' : 'synthetic-no-query') || o.maxTurns !== LIMITS.maxTurns || o.maxBudgetUsd !== LIMITS.maxBudgetUsd
    || !exact(o.tools, ['Read']) || !exact(o.allowedTools, ['Read'])
    || !exact(o.disallowedTools, ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill']) || o.permissionMode !== 'dontAsk' || o.thinking?.type !== 'disabled'
    || !exact(o.settingSources, []) || !exact(o.plugins, []) || !exact(o.skills, []) || Object.keys(o.mcpServers ?? {}).length
    || o.strictMcpConfig !== true || Object.keys(o.env ?? {}).some(k => k.startsWith('FLOW_') || k.includes('DATABASE'))) throw new Error('Query capabilities or budget mismatch');
  report.requested = { model: o.model, maxTurns: o.maxTurns, maxBudgetUsd: o.maxBudgetUsd, permissionMode: o.permissionMode,
    tools: o.tools, allowedTools: o.allowedTools, thinking: o.thinking, mcpServers: [], settingSources: [], plugins: [], skills: [] };
}
export function observeFrame(event, report) {
  if (event.type === 'system' && event.subtype === 'init') {
    report.effective = { model: label(event.model), permissionMode: label(event.permissionMode), tools: event.tools?.slice(0, 32) ?? null,
      plugins: event.plugins?.slice(0, 16).map(p => ({ name: label(p.name), version: label(p.version) })) ?? null,
      skills: event.skills?.slice(0, 32) ?? null, mcpServers: event.mcp_servers?.slice(0, 16).map(s => ({ name: label(s.name), source: label(s.source), status: label(s.status) })) ?? null,
      runtimeVersion: label(event.claude_code_version), nativeSessionId: label(event.session_id), observationKind: 'sdk-init-declaration' };
    if (!exact(event.tools, ['Read']) || !exact(event.plugins?.map(p => p.name), MANAGED_BASELINE.plugins)
      || !exact(event.skills, MANAGED_BASELINE.skills) || !exact(event.mcp_servers, []) || event.permissionMode !== 'dontAsk' || !label(event.model)) throw new Error('SDK declarations differ from the allowed baseline');
  }
  if (event.parent_tool_use_id == null && event.type === 'assistant') {
    for (const block of event.message?.content ?? []) if (block.type === 'tool_use') {
      if (block.name !== 'Read' || !label(block.id)) throw new Error('Unexpected native tool call');
      report.readObservations ??= [];
      if (report.readObservations.some(r => r.id === block.id)) continue;
      if (report.readObservations.length >= 8) throw new Error('Read observation bound exceeded');
      report.readObservations.push({ id: block.id, toolName: 'Read', state: 'requested' });
    }
  }
  if (event.parent_tool_use_id == null && event.type === 'user') {
    for (const block of event.message?.content ?? []) if (block.type === 'tool_result') {
      const row = report.readObservations?.find(r => r.id === block.tool_use_id);
      if (!row) throw new Error('Unmatched native tool result');
      const text = typeof block.content === 'string' ? block.content : Array.isArray(block.content) ? block.content.filter(b => b.type === 'text').map(b => b.text).join('\n') : '';
      const result = { state: block.is_error === true ? 'reported-error' : 'reported-success', contentDigest: digest(text), containsSyntheticMaterial: text.includes(MATERIAL) };
      if (row.contentDigest && (row.contentDigest !== result.contentDigest || row.state !== result.state)) throw new Error('Conflicting native Read result');
      Object.assign(row, result);
    }
  }
  if (event.type === 'result') {
    report.permissionDenials = { state: Array.isArray(event.permission_denials) ? 'reported' : 'unknown', total: event.permission_denials?.length ?? null,
      entries: event.permission_denials?.slice(0, 32).map(d => ({ toolName: label(d.tool_name), toolUseId: label(d.tool_use_id) })) ?? [], parametersOmitted: true, truncated: (event.permission_denials?.length ?? 0) > 32 };
    report.result = { subtype: label(event.subtype), isError: event.is_error, nativeSessionId: label(event.session_id), sourceMessageId: label(event.uuid), numTurns: event.num_turns ?? null,
      sdkEstimatedCostUsd: event.total_cost_usd ?? null, modelUsage: event.modelUsage ?? null };
    if (!Number.isInteger(event.num_turns) || event.num_turns < 1 || event.num_turns > LIMITS.maxTurns || !Number.isFinite(event.total_cost_usd) || event.total_cost_usd < 0 || event.total_cost_usd > LIMITS.maxBudgetUsd) throw new Error('SDK accounting is missing or outside the proposed limits');
  }
}
