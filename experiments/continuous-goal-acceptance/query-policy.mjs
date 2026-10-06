import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { DECLARATIONS, GRAPH_TOOLS, MATERIAL } from './config.mjs';
import { PHASE_LIMITS } from './permit.mjs';
const hash = text => createHash('sha256').update(text).digest('hex');
const label = value => typeof value === 'string' && value.length > 0 && value.length <= 160 ? value : null;
const sameNames = (actual, expected) => Array.isArray(actual) && actual.every(value => typeof value === 'string')
  && isDeepStrictEqual([...actual].sort(), [...expected].sort());
function check(condition, message) { if (!condition) throw new Error(message); }

/** Observes SDK declarations/results only. Runtime authority and SDK iteration remain the original adapter's. */
export function createQueryObservation(phase) {
  check(Object.hasOwn(PHASE_LIMITS, phase), 'Unknown observation phase.');
  const limits = PHASE_LIMITS[phase], tools = phase === 'plan' ? GRAPH_TOOLS : ['Read'];
  const facts = { phase, effective: null, reads: [], result: null, permissionDenials: null,
    toolExecutionEvidence: phase === 'plan' ? 'center-audit-required' : 'matching-read-result-required', semanticAcceptance: 'not-evaluated' };
  let frames = 0, failure = null;
  function observeInit(event) {
    const effective = { model: label(event.model), permissionMode: label(event.permissionMode), tools: event.tools,
      plugins: event.plugins?.map(plugin => label(plugin.name)), skills: event.skills,
      mcpServers: event.mcp_servers?.map(server => ({ name: label(server.name), source: label(server.source), status: label(server.status) })),
      runtimeVersion: label(event.claude_code_version), nativeSessionId: label(event.session_id), kind: 'sdk-init-declaration' };
    check(!facts.effective || isDeepStrictEqual(effective, facts.effective), 'Conflicting SDK declarations.');
    facts.effective = effective;
    check(effective.model === DECLARATIONS.model && effective.runtimeVersion === DECLARATIONS.runtimeVersion
      && effective.permissionMode === 'dontAsk' && effective.nativeSessionId && sameNames(effective.tools, tools)
      && sameNames(effective.plugins, DECLARATIONS.plugins) && sameNames(effective.skills, DECLARATIONS.skills)
      && isDeepStrictEqual(effective.mcpServers, phase === 'plan' ? [{ name: 'flow-graph', source: 'sdk', status: 'connected' }] : []), 'SDK declarations differ from the fixed observed baseline.');
  }
  function observeToolUse(block) {
    check(facts.effective && label(block.id), 'Missing tool-use identity or init declaration.');
    check(tools.includes(block.name), 'Unexpected native tool request.');
    if (phase === 'children' && !facts.reads.some(row => row.id === block.id)) {
      check(facts.reads.length < 8, 'Read observation bound exceeded.'); facts.reads.push({ id: block.id, state: 'requested' });
    }
  }
  function observeToolResult(block) {
    if (phase !== 'children') return; // Planner execution authority is verified from the center's audited proposal.
    const row = facts.reads.find(item => item.id === block.tool_use_id);
    check(row, 'Unmatched native tool result.');
    const content = typeof block.content === 'string' ? block.content : Array.isArray(block.content)
      ? block.content.filter(item => item.type === 'text').map(item => item.text).join('\n') : '';
    check(Buffer.byteLength(content) <= 65_536, 'Read result exceeds observation bound.');
    const observed = { state: block.is_error === true ? 'reported-error' : 'reported-success', contentDigest: hash(content), containsFixedMaterial: content.includes(MATERIAL) };
    check(!row.contentDigest || row.contentDigest === observed.contentDigest && row.state === observed.state, 'Conflicting native tool result.');
    Object.assign(row, observed);
  }
  function observeResult(event) {
    check(facts.effective && label(event.uuid) && event.session_id === facts.effective.nativeSessionId, 'Final identity is missing or mismatched.');
    const result = { subtype: label(event.subtype), isError: event.is_error, nativeSessionId: event.session_id, sourceMessageId: event.uuid,
      numTurns: event.num_turns ?? null, sdkEstimatedCostUsd: event.total_cost_usd ?? null, modelUsage: event.modelUsage ?? null };
    check(!facts.result || isDeepStrictEqual(result, facts.result), 'Conflicting native final.'); facts.result = structuredClone(result);
    check(Number.isInteger(result.numTurns) && result.numTurns >= 1 && result.numTurns <= limits.maxTurns
      && Number.isFinite(result.sdkEstimatedCostUsd) && result.sdkEstimatedCostUsd >= 0 && result.sdkEstimatedCostUsd <= limits.maxBudgetUsd,
    'SDK accounting is missing or outside the fixed request.');
    check(event.modelUsage && typeof event.modelUsage === 'object' && !Array.isArray(event.modelUsage)
      && Object.keys(event.modelUsage).length <= 16 && Buffer.byteLength(JSON.stringify(event.modelUsage)) <= 16_384, 'SDK model accounting exceeds its bound.');
    check(Array.isArray(event.permission_denials) && event.permission_denials.length <= 32, 'Permission denial observations are missing or unbounded.');
    facts.permissionDenials = event.permission_denials.map(item => ({ toolName: label(item.tool_name), toolUseId: label(item.tool_use_id) }));
    check(result.subtype === 'success' && result.isError === false && facts.permissionDenials.length === 0, 'SDK result or permission outcome was not successful.');
  }
  function observeFrame(event) {
    check(++frames <= 2048 && Buffer.byteLength(JSON.stringify(event) ?? '') <= 262_144, 'SDK observation bound exceeded.');
    if (event?.type === 'system' && event.subtype === 'init') observeInit(event);
    if (['assistant', 'user'].includes(event?.type)) {
      check(event.parent_tool_use_id == null, 'Nested tool execution is outside the finite policy.');
      for (const block of event.message?.content ?? []) {
        if (block.type === 'tool_use') observeToolUse(block);
        if (block.type === 'tool_result') observeToolResult(block);
      }
    }
    if (event?.type === 'result') observeResult(event);
  }
  function frame(event) {
    check(!failure, 'SDK observation was already rejected.');
    try { observeFrame(event); } catch (error) { failure = 'observation-rejected'; throw error; }
  }
  function snapshot() { return structuredClone({ ...facts, frames, failure }); }
  function finish() {
    check(!failure, 'SDK observation was rejected.');
    check(facts.effective && facts.result && facts.permissionDenials, 'SDK observations are incomplete.');
    if (phase === 'children') check(facts.reads.some(row => row.state === 'reported-success' && row.containsFixedMaterial), 'Matching successful material Read evidence is required.');
    return snapshot();
  }
  return { frame, snapshot, finish };
}
