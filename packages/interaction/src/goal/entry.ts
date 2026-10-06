import { z } from 'zod';
import { FlowApiError, type FlowClient } from '@flow/client';
import { goalCreationSchema, type GoalCreation } from '../../../contracts/src/goals.js';
import { idSchema } from '../../../contracts/src/tasks.js';

export interface GoalEntryRecord {
  version: 1; connectionId: string; entryId: string; key: string; input: GoalCreation; goalId: string | null;
}
/** Host-owned atomic durable store, exclusively owned per namespace; it contains no credentials. */
export interface GoalEntryStore {
  load(namespace: string): Promise<unknown | null>;
  save(namespace: string, record: GoalEntryRecord | null): Promise<void>;
}
export interface GoalEntryOptions {
  connectionId: string; entryId: string; store: GoalEntryStore; client: Pick<FlowClient, 'createGoal'>; makeKey?: () => string;
}
export type GoalEntryOutcome = { state: 'bound'; goalId: string; key: string }
  | { state: 'rejected'; key: string; code: string } | { state: 'unknown'; key: string };
const recordSchema = z.strictObject({ version: z.literal(1), connectionId: z.string().min(1).max(256), entryId: idSchema,
  key: z.string().min(1).max(200), input: goalCreationSchema, goalId: idSchema.nullable() });
function parseRecord(value: unknown): GoalEntryRecord {
  const record = recordSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(record)).byteLength > 32_768) throw Error('Goal entry exceeds its 32 KiB bound.');
  return record;
}
const receiptSchema = z.object({ goal: goalCreationSchema.extend({ id: idSchema, createdAt: z.string() }), replayed: z.boolean() });

/** One natural-language intake, then a stable goalId for the existing GoalSession. No read starts planning or execution. */
export function createGoalEntry(options: GoalEntryOptions) {
  const { connectionId, entryId } = recordSchema.pick({ connectionId: true, entryId: true }).parse({ connectionId: options.connectionId, entryId: options.entryId });
  const namespace = JSON.stringify(['flow.goal-entry.v1', connectionId, entryId]);
  const lifetime = new AbortController();
  let connected = true, initialized = false, record: GoalEntryRecord | null = null;
  let operation: Promise<GoalEntryOutcome> | null = null, initializing: Promise<void> | null = null;
  function active() { if (!connected) throw Error('Goal entry is disconnected.'); }
  function ready() { active(); if (!initialized) throw Error('Initialize this goal entry first.'); }
  function snapshot() { return structuredClone({ connected, initialized, goalId: record?.goalId ?? null, intent: record?.goalId ? null : record, busy: operation !== null }); }
  function initialize(): Promise<void> {
    active(); if (initialized) return Promise.resolve(); if (initializing) return initializing;
    initializing = (async () => {
      const saved = await options.store.load(namespace);
      if (!connected) return;
      if (saved !== null) {
        const parsed = parseRecord(saved);
        if (parsed.connectionId !== connectionId || parsed.entryId !== entryId) throw Error('Stored entry namespace mismatch.');
        record = parsed;
      }
      initialized = true;
    })().finally(() => { initializing = null; });
    return initializing;
  }
  async function send(intent: GoalEntryRecord, recovering: boolean): Promise<GoalEntryOutcome> {
    try { await options.store.save(namespace, structuredClone(intent)); }
    catch { return { state: 'unknown', key: intent.key }; }
    if (lifetime.signal.aborted) return { state: 'unknown', key: intent.key };
    let responseReceived = false;
    try {
      const raw = await options.client.createGoal(structuredClone(intent.input), intent.key, lifetime.signal); responseReceived = true;
      const accepted = receiptSchema.parse(raw).goal;
      if (Object.entries(intent.input).some(([key, value]) => accepted[key as keyof GoalCreation] !== value)) throw Error('Goal creation receipt identity mismatch.');
      const bound = { ...intent, goalId: accepted.id };
      await options.store.save(namespace, structuredClone(bound)); record = bound;
      return { state: 'bound', goalId: bound.goalId, key: intent.key };
    } catch (error) {
      if (!recovering && !responseReceived && error instanceof FlowApiError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
        try { await options.store.save(namespace, null); record = null; return { state: 'rejected', key: intent.key, code: error.code }; }
        catch { /* A failed local clear leaves the original creation recoverable. */ }
      }
      return { state: 'unknown', key: intent.key };
    }
  }
  function start(intent: GoalEntryRecord, recovering: boolean) {
    record = intent; operation = send(intent, recovering).finally(() => { operation = null; }); return operation;
  }
  function submit(input: GoalCreation): Promise<GoalEntryOutcome> {
    ready(); if (record?.goalId) throw Error('This entry is already bound to a goal.');
    if (operation || record) throw Error('Resolve the unresolved goal creation first.');
    return start(parseRecord({ version: 1, connectionId, entryId, key: (options.makeKey ?? (() => crypto.randomUUID()))(), input, goalId: null }), false);
  }
  function recover(): Promise<GoalEntryOutcome> {
    ready(); if (operation) throw Error('A goal creation is already in flight.');
    if (!record || record.goalId) throw Error('No unresolved goal creation to recover.');
    return start(record, true);
  }
  function disconnect() { connected = false; lifetime.abort(); }
  async function dispose() { disconnect(); await Promise.allSettled([...(operation ? [operation] : []), ...(initializing ? [initializing] : [])]); }
  return { initialize, submit, recover, snapshot, disconnect, dispose };
}
