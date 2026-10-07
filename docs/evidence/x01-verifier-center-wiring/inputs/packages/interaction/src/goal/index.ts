import { FlowApiError } from '@flow/client';
import { goalDeliveryQuerySchema } from '../../../contracts/src/goal-delivery.js';
import type { GoalDeliveryPlan, GoalDeliveryState, GoalDeliveryExplanations, GoalDeliveryQuery } from '../../../contracts/src/goal-delivery.js';
import { idSchema } from '../../../contracts/src/tasks.js';
import { goalGraphRunListQuerySchema } from '../../../contracts/src/goal-graph-runs.js';
import { ObservationReads } from '../observation/reads.js';
import { checkReceipt, dispatch, parseCommand, parseIntent } from './commands.js';
import { checkRead, readBody, checkPlanningPage } from './reads.js';
import type { GoalBodyReference, GoalCommandOutcome, GoalIntent, GoalSessionCommand, GoalSessionOptions, GoalSessionSnapshot } from './types.js';
export type * from './types.js';
export { createGoalEntry, type GoalEntryOptions, type GoalEntryStore, type GoalEntryRecord, type GoalEntryOutcome } from './entry.js';

/** A single explicit goal session. Center owns scheduling, CAS and task truth; this owns local observation and one durable intent. */
export function createGoalSession(options: GoalSessionOptions) {
  const goalId = idSchema.parse(options.goalId);
  if (!options.connectionId || options.connectionId.length > 256) throw Error('A bounded connection identity is required.');
  const namespace = JSON.stringify(['flow.goal-session.v1', options.connectionId, goalId]);
  const listeners = new Set<(snapshot: GoalSessionSnapshot) => void>();
  const pendingReads = new Set<Promise<unknown>>();
  const reads = new ObservationReads(); const lifetime = new AbortController();
  let disposed = false, epoch = 0, operation: Promise<GoalCommandOutcome> | null = null, initializing: Promise<void> | null = null;
  const generations = { plan: 0, state: 0, history: 0, body: 0, planning: 0 };
  const state: GoalSessionSnapshot = { connected: true, initialized: false, plan: null, state: null, history: null, body: null, intent: null, commandState: 'idle', lastOutcome: null };
  function snapshot() { return structuredClone(state); }
  function publish() { for (const listener of listeners) { try { listener(snapshot()); } catch { /* A renderer cannot corrupt a durable command. */ } } }
  function active() { if (disposed || !state.connected) throw Error('Goal session is disconnected.'); }
  function ready() { active(); if (!state.initialized || !state.plan) throw Error('Initialize this goal session first.'); }
  function runRead<T>(signal: AbortSignal, read: () => Promise<T>): Promise<T> {
    const pending = reads.run(signal, read); pendingReads.add(pending);
    void pending.then(() => pendingReads.delete(pending), () => pendingReads.delete(pending)); return pending;
  }
  async function query(input: GoalDeliveryQuery) {
    active(); const parsed = goalDeliveryQuerySchema.parse(input), signal = lifetime.signal;
    return runRead(signal, async () => checkRead(goalId, parsed, await options.client.goalDelivery(goalId, parsed, signal)));
  }
  async function plan(input: { after?: string; limit?: number } = {}): Promise<GoalDeliveryPlan> {
    active(); const mine = ++generations.plan, started = epoch;
    const result = await query({ view: 'plan', ...input }) as GoalDeliveryPlan;
    if (started === epoch && mine === generations.plan && state.connected) {
      if (input.after && state.plan && state.plan.planRef !== result.planRef) throw Error('Plan changed while paging. Start a new plan read.');
      const nodes = input.after && state.plan ? [...new Map([...state.plan.nodes, ...result.nodes].map(n => [n.id, n])).values()] : result.nodes;
      if (nodes.length > 200 || nodes.length > result.totalNodes) throw Error('Plan cache exceeds its bound.');
      if (state.plan && state.plan.planRef !== result.planRef) { state.state = null; generations.state++; }
      state.plan = structuredClone({ ...result, nodes }); publish();
    }
    return result;
  }
  async function initialize(): Promise<void> {
    active(); if (state.initialized) return; if (initializing) return initializing;
    const started = epoch;
    initializing = (async () => {
      const saved = await options.intents.load(namespace);
      if (started !== epoch || !state.connected) return;
      if (saved !== null) {
        const intent = parseIntent(saved);
        if (intent.goalId !== goalId || intent.connectionId !== options.connectionId) throw Error('Stored goal intent namespace mismatch.');
        state.intent = intent; state.commandState = 'unknown'; publish();
      }
      const current = await plan();
      if (started !== epoch || !state.connected) return;
      if (state.intent && state.intent.projectId !== current.projectId) throw Error('Stored project identity mismatch.');
      state.initialized = true; publish();
    })().finally(() => { initializing = null; });
    return initializing;
  }
  async function observe(nodeIds: string[]): Promise<GoalDeliveryState> {
    ready(); const mine = ++generations.state, started = epoch;
    const result = await query({ view: 'state', nodeIds: [...nodeIds] }) as GoalDeliveryState;
    if (result.projectId !== state.plan!.projectId) throw Error('Observed project identity mismatch.');
    if (started === epoch && mine === generations.state && state.connected) { state.state = structuredClone(result); publish(); }
    return result;
  }
  async function history(input: { after?: string; limit?: number } = {}): Promise<GoalDeliveryExplanations> {
    ready(); const mine = ++generations.history, started = epoch;
    const result = await query({ view: 'explanations', ...input }) as GoalDeliveryExplanations;
    if (started === epoch && mine === generations.history && state.connected) { state.history = structuredClone(result); publish(); }
    return result;
  }
  async function planning(input: { after?: string; limit?: number } = {}) {
    ready(); if (!options.client.goalGraphRuns) throw Error('Planning reads are not available on this client.');
    const query = goalGraphRunListQuerySchema.parse(input), mine = ++generations.planning, started = epoch, signal = lifetime.signal;
    const result = await runRead(signal, async () => checkPlanningPage(goalId, state.plan!.projectId,
      await options.client.goalGraphRuns!(goalId, query, signal), query.limit));
    if (query.after && result.nextCursor === query.after) throw Error('Planning cursor did not advance.');
    if (started === epoch && mine === generations.planning && state.connected) { state.planning = structuredClone(result); publish(); }
    return result;
  }
  async function read(reference: GoalBodyReference) {
    ready(); const copy = structuredClone(reference), mine = ++generations.body, started = epoch, signal = lifetime.signal;
    if (copy.kind === 'artifact') {
      const candidates = state.state?.nodes.flatMap(n => [n.accepted, n.execution?.artifact]) ?? [];
      if (!candidates.some(b => b && Object.keys(b).every(key => b[key as keyof typeof b] === copy.binding[key as keyof typeof b]))) throw Error('Observe this exact artifact binding before reading it.');
    }
    const result = await runRead(signal, () => readBody(options.client, goalId, copy, signal));
    if (started === epoch && mine === generations.body && state.connected) { state.body = structuredClone(result); publish(); }
    return result;
  }
  function requireObservedTask(c: GoalSessionCommand) {
    if (c.kind === 'graph-plan') {
      if (!options.client.admitGoalGraphRun) throw Error('Goal planning is not available on this client.');
      if (c.input.scope.baseRevision !== state.plan?.projectRevision) throw Error('Observe the planning base revision first.');
    }
    if (c.kind === 'native-execute') {
      if (!options.client.executeGoalNative) throw Error('Native goal execution is not available on this client.');
      const node = state.state?.nodes.find(n => n.nodeId === c.input.nodeId);
      if (!node || node.inputRef?.version !== c.input.expectedInputVersion || (node.execution?.id ?? null) !== c.input.previousExecutionId) throw Error('Observe the selected actual input and previous execution first.');
    }
    if (c.kind !== 'decision' && c.kind !== 'cancel') return;
    const execution = state.state?.nodes.find(n => n.nodeId === c.nodeId)?.execution;
    if (execution?.task.id !== c.taskId) throw Error('Observe the selected goal task before commanding it.');
    if (c.kind === 'decision' && execution.pendingDecision?.decisionId !== c.input.decisionId) throw Error('Observe the exact pending decision first.');
  }
  async function transmit(intent: GoalIntent, recovering: boolean, signal: AbortSignal): Promise<GoalCommandOutcome> {
    state.commandState = 'sending'; publish();
    let outcome: GoalCommandOutcome, responseReceived = false;
    try {
      const receipt = await dispatch(options.client, structuredClone(intent), signal); responseReceived = true; checkReceipt(intent, receipt);
      await options.intents.save(namespace, null); state.intent = null; state.commandState = 'idle';
      outcome = { state: 'acknowledged', key: intent.key, receipt };
    } catch (error) {
      if (!recovering && !responseReceived && error instanceof FlowApiError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
        try {
          await options.intents.save(namespace, null); state.intent = null; state.commandState = 'idle';
          outcome = { state: 'rejected', key: intent.key, code: error.code };
        } catch { state.commandState = 'unknown'; outcome = { state: 'unknown', key: intent.key }; }
      } else { state.commandState = 'unknown'; outcome = { state: 'unknown', key: intent.key }; }
    }
    state.lastOutcome = { state: outcome.state, key: outcome.key, ...(outcome.state === 'rejected' ? { code: outcome.code } : {}) }; publish();
    // A definite CAS rejection may refresh observation; it never creates a replacement command.
    if (outcome.state === 'rejected' && state.connected) { try { await plan(); } catch { /* Rejection remains authoritative; stale observation is not success. */ } }
    return outcome;
  }
  function command(input: GoalSessionCommand): Promise<GoalCommandOutcome> {
    ready(); if (operation || state.intent) throw Error('Resolve the existing command before creating another.');
    const command = parseCommand(input); requireObservedTask(command);
    const intent = parseIntent({ version: 1, connectionId: options.connectionId, goalId, projectId: state.plan!.projectId, key: (options.makeKey ?? (() => crypto.randomUUID()))(), command });
    const signal = lifetime.signal;
    operation = (async () => {
      // No remote dispatch before the host confirms durable storage. An interrupted save still leaves recovery data.
      state.intent = intent; state.commandState = 'unknown';
      try { await options.intents.save(namespace, structuredClone(intent)); } catch { publish(); return { state: 'unknown', key: intent.key } as const; }
      if (signal.aborted) { state.commandState = 'unknown'; publish(); return { state: 'unknown', key: intent.key } as const; }
      return transmit(intent, false, signal);
    })().finally(() => { operation = null; });
    return operation;
  }
  function recover(): Promise<GoalCommandOutcome> {
    ready(); if (operation) throw Error('A command is already in flight.'); if (!state.intent) throw Error('No unresolved command to recover.');
    const intent = state.intent, signal = lifetime.signal;
    operation = Promise.resolve().then(async () => {
      // A previous save may have failed before or after commit. Confirm the same intent before any retry.
      try { await options.intents.save(namespace, structuredClone(intent)); } catch { return { state: 'unknown', key: intent.key } as const; }
      if (signal.aborted) return { state: 'unknown', key: intent.key } as const;
      return transmit(intent, true, signal);
    }).finally(() => { operation = null; }); return operation;
  }
  function disconnect() { if (!state.connected) return; state.connected = false; epoch++; lifetime.abort(); publish(); }
  async function dispose() { disposed = true; disconnect(); await Promise.allSettled([...pendingReads, ...(operation ? [operation] : []), ...(initializing ? [initializing] : [])]); listeners.clear(); }
  return { initialize, plan, observe, history, planning, read, command, recover, snapshot, disconnect, dispose,
    subscribe(listener: (value: GoalSessionSnapshot) => void) { if (disposed) throw Error('Goal session is disposed.'); listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
export type GoalSession = ReturnType<typeof createGoalSession>;
