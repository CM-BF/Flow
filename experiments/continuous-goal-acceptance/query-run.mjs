import { isDeepStrictEqual } from 'node:util';
import { createQueryObservation } from './query-policy.mjs';
import { PHASE_LIMITS, consumeSlot, assertNativePermit, NATIVE_MODEL } from './permit.mjs';
import { failureFact } from './stage-policy.mjs';
import { GRAPH_TOOLS } from './config.mjs';
import { recordHostDecisions } from '../native-graph-acceptance/guard.mjs';

function requireValue(value) { if (!value) throw new Error('The actual query request differs from the finite phase policy.'); }
export function checkQueryOptions(input, mode, phase) {
  requireValue(['native', 'rehearsal'].includes(mode) && Object.hasOwn(PHASE_LIMITS, phase));
  const o = input.options, limits = PHASE_LIMITS[phase], graph = phase === 'plan';
  requireValue(o && typeof input.prompt === 'string' && Buffer.byteLength(input.prompt) <= 262_144
    && o.model === (mode === 'native' ? NATIVE_MODEL : 'synthetic-no-query') && o.maxTurns === limits.maxTurns && o.maxBudgetUsd === limits.maxBudgetUsd
    && !o.resume && o.abortController instanceof AbortController && o.permissionMode === 'dontAsk' && o.strictMcpConfig === true
    && isDeepStrictEqual(o.tools, graph ? [] : ['Read']) && isDeepStrictEqual([...(o.allowedTools ?? [])].sort(), [...(graph ? GRAPH_TOOLS : ['Read'])].sort())
    && isDeepStrictEqual(o.disallowedTools, ['Bash', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Agent', 'Task', 'Skill'])
    && isDeepStrictEqual(o.settingSources, []) && isDeepStrictEqual(o.plugins, []) && isDeepStrictEqual(o.skills, [])
    && isDeepStrictEqual(o.thinking, { type: 'disabled' }) && o.effort === undefined && typeof o.canUseTool === 'function'
    && isDeepStrictEqual(o.settings, { enabledPlugins: {}, autoMemoryEnabled: false, syncClaudeAiPlugins: false, syncClaudeAiSkills: false,
      disableBundledSkills: true, disableSkillShellExecution: true, claudeMdExcludes: ['**'] })
    && isDeepStrictEqual(Object.keys(o.mcpServers ?? {}), graph ? ['flow-graph'] : []));
  if (graph) requireValue(o.mcpServers['flow-graph'].type === 'sdk' && o.mcpServers['flow-graph'].name === 'flow-graph');
  return { model: o.model, maxTurns: o.maxTurns, maxBudgetUsd: o.maxBudgetUsd, permissionMode: o.permissionMode,
    tools: [...o.tools], allowedTools: [...o.allowedTools], settings: structuredClone(o.settings), resume: null };
}

/** O16 only: preserve the original adapter input and its single iterator; no resumable transcript. */
export function oneShotQueryInput(input) {
  requireValue(input?.options && input.options.resume === undefined && input.options.continue === undefined
    && input.options.sessionStore === undefined && input.options.forkSession === undefined);
  // The existing decision recorder wraps hook functions; give it private matcher arrays as well.
  const hooks = input.options.hooks && Object.fromEntries(Object.entries(input.options.hooks).map(([event, matchers]) =>
    [event, matchers.map(matcher => ({ ...matcher, hooks: [...matcher.hooks] }))]));
  return { ...input, options: { ...input.options, hooks, persistSession: false } };
}

/** The original adapter remains the sole stream consumer. This decorates that same iterator and its close. */
export function createObservedQuery({ mode, phase, reservation, getBinding, nativeQuery, rehearseQuery, report, nativeEnvironment }) {
  const seenTasks = new Set(), seenSlots = new Set();
  report.queries = [];
  return input => {
    const prepared = oneShotQueryInput(input);
    const requested = { ...checkQueryOptions(prepared, mode, phase), persistSession: false }, binding = getBinding();
    requireValue(binding && (phase === 'plan' ? binding.slot === 'planner' : ['child-1', 'child-2'].includes(binding.slot))
      && !seenTasks.has(binding.assignment.taskId) && !seenSlots.has(binding.slot) && seenSlots.size < PHASE_LIMITS[phase].queries);
    seenTasks.add(binding.assignment.taskId); seenSlots.add(binding.slot);
    const row = { binding: structuredClone(binding), requested, entry: 'not-started', closed: false, observation: null };
    report.queries.push(row); recordHostDecisions(prepared, row);
    const observed = createQueryObservation(phase);
    let original, closed = false;
    const stream = Object.assign((async function* () {
      try {
        input.options.abortController.signal.throwIfAborted(); requireValue(!closed);
        if (mode === 'native') {
          requireValue(typeof nativeQuery === 'function' && reservation && nativeEnvironment);
          assertNativePermit(reservation.permit, nativeEnvironment.policy.digest);
          requireValue(nativeEnvironment.binding.sourceDigest === reservation.permit.sourceDigest);
          await nativeEnvironment.policy.verify(nativeEnvironment.binding, nativeEnvironment.source);
          row.reservation = await consumeSlot(reservation, binding.slot, binding.assignment);
          // A cancelled entry stays consumed. It must not start after the durable write resolves.
          input.options.abortController.signal.throwIfAborted(); requireValue(!closed);
          const actual = await nativeEnvironment.policy.queryInput(nativeEnvironment.binding, nativeEnvironment.source, prepared);
          input.options.abortController.signal.throwIfAborted(); requireValue(!closed);
          row.environmentDigest = nativeEnvironment.policy.digest; row.writePolicy = nativeEnvironment.policy.recipe.writePolicy;
          row.entry = 'native-started-unknown'; report.nativeQueryCalls++;
          original = nativeQuery(actual);
        } else { row.entry = 'injected'; original = rehearseQuery(prepared, binding, row); }
        for await (const frame of original) { observed.frame(frame); yield frame; }
        row.observation = observed.finish(); row.entry = mode === 'native' ? 'native-result-observed' : 'injected-result-observed';
      } catch (error) {
        row.observation = observed.snapshot(); row.failure = 'query-or-observation-unconfirmed'; row.firstFailure = failureFact(error);
        input.options.abortController.abort(error); throw error;
      } finally { row.observation ??= observed.snapshot(); }
    })(), { close() { closed = true; row.closed = true; original?.close(); } });
    if (mode === 'native') stream.getContextUsage = async options => {
      // Preserve the original adapter's single bounded summary read; this is not a model query.
      requireValue(!closed && original && typeof original.getContextUsage === 'function');
      return original.getContextUsage(options);
    };
    return stream;
  };
}
