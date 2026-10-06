import { randomUUID } from 'node:crypto';
import { FlowApiError } from '@flow/client';
import { conversationCreationSchema, conversationTurnSchema, type ConversationSummary, type ExecutionProfile } from '@flow/contracts';
import { commandDescriptors, commandSchema, parseInput, type Command } from './commands.js';
import { turnView } from './projection.js';
import { acknowledgedConversation } from './acknowledgement.js';
import { intentSchema, type CommandResult, type Intent, type IntentStore, type InteractionClient, type InteractionController, type InteractionSnapshot } from './types.js';
class LocalError extends Error { constructor(readonly code: string, message: string) { super(message); } }
const result = (ok: boolean, code: string, message: string): CommandResult => ({ ok, code, message });
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; };

/** Owns local observation and immutable intent, never center task/queue/execution state. */
export function createInteractionController(options: { client: InteractionClient; connectionId: string; intents: IntentStore; makeKey?: () => string; pollMs?: number }): InteractionController {
  if (!options.connectionId || options.connectionId.length > 160 || options.pollMs !== undefined && (!Number.isInteger(options.pollMs) || options.pollMs < 100 || options.pollMs > 60_000)) throw new Error('Invalid interaction options');
  const { client, intents } = options;
  let state: InteractionSnapshot = freeze({ view: 'conversations', connected: false, busy: false, closed: false, draft: '', notice: 'Use /help or /conversations.', selected: null, turns: [], conversations: [], conversationCursor: null, profiles: [], profileCursor: null, pending: null });
  const listeners = new Set<() => void>();
  let initialized = false; let epoch = 0; let connection = new AbortController(); let timer: NodeJS.Timeout | undefined;
  let activeMutation: Promise<CommandResult> | null = null;
  let disposed: Promise<void> | null = null;
  let intent: Intent | null = null; let profiles: ExecutionProfile[] = [];
  function patch(value: Partial<InteractionSnapshot>) { state = freeze({ ...state, ...value }); for (const listener of listeners) listener(); }
  function rotate() { clearTimeout(timer); timer = undefined; connection.abort(); connection = new AbortController(); epoch++; }
  function current(version: number) { return version === epoch && !state.closed; }
  function selection(conversation: ConversationSummary) { return { id: conversation.id, title: conversation.title, revision: conversation.revision, requestedModel: conversation.requested.model }; }
  function schedule() {
    clearTimeout(timer); timer = undefined;
    if (!state.connected || state.closed || !state.selected) return;
    timer = setTimeout(async () => {
      const version = epoch;
      if (!state.busy) { try { await refresh(state.selected!.id, version); } catch { if (current(version)) patch({ connected: false, notice: 'Observation interrupted. Use /recover; center tasks continue.' }); } }
      schedule();
    }, options.pollMs ?? 1000);
  }
  async function refresh(id: string, version: number) {
    const snapshot = await client.conversation(id, connection.signal);
    if (!current(version)) return;
    if (snapshot.conversation.id !== id) throw new LocalError('INVALID_RESPONSE', 'Conversation identity mismatch.');
    const page = await client.conversationTurns(id, { after: Math.max(0, (snapshot.lastTurn?.number ?? 0) - 20), limit: 20 }, connection.signal);
    if (!current(version)) return;
    if (page.conversation.id !== id || page.turns.length > 20 || page.turns.some(turn => turn.conversationId !== id)) throw new LocalError('INVALID_RESPONSE', 'History identity or bound mismatch.');
    patch({ selected: selection(page.conversation), turns: page.turns.map(turnView), connected: true });
  }
  function requireFree() { if (intent) throw new LocalError('UNRESOLVED', 'An earlier request is unresolved. Use /recover with its original identity.'); }
  async function mutate(pending: Intent, recovering: boolean) {
    rotate();
    const operation = performMutation(pending, recovering); activeMutation = operation;
    try { return await operation; } finally { if (activeMutation === operation) activeMutation = null; schedule(); }
  }
  async function performMutation(pending: Intent, recovering: boolean) {
    const version = epoch; const signal = connection.signal;
    if (!recovering) { await intents.save(pending); intent = pending; }
    patch({ pending: { kind: pending.kind, status: 'sending' } });
    try {
      if (!current(version) || signal.aborted) throw new LocalError('UNKNOWN', 'Disconnected before dispatch.');
      const response = pending.kind === 'create' ? await client.createConversation(pending.input, pending.key, signal)
        : await client.submitConversationTurn(pending.conversationId, pending.input, pending.key, signal);
      if (!current(version)) throw new LocalError('UNKNOWN', 'Observation changed before acknowledgement was accepted.');
      const conversation = acknowledgedConversation(pending, response);
      await intents.clear(); intent = null;
      if (!current(version)) { patch({ pending: null }); return result(true, 'ACCEPTED', 'Center accepted the request; observation remains stopped.'); }
      const selected = state.selected?.id === conversation.id && state.selected.revision > conversation.revision ? state.selected : selection(conversation);
      patch({ pending: null, view: 'conversation', selected, connected: true,
        ...(pending.kind === 'send' && state.draft === pending.input.text ? { draft: '' } : {}) });
      try { await refresh(conversation.id, version); } catch { if (current(version)) patch({ connected: false, notice: 'Accepted by center. Observation needs /recover.' }); }
      schedule(); return result(true, 'ACCEPTED', 'Center accepted the request; this is not execution completion.');
    } catch (error) {
      if (!recovering && error instanceof FlowApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && !error.code.includes('idempotency')) {
        try {
          await intents.clear(); intent = null; patch({ pending: null });
          if (current(version) && state.selected) {
            try { await refresh(state.selected.id, version); }
            catch { if (current(version)) patch({ connected: false }); }
          }
          return result(false, `HTTP_${error.status}`, 'Center rejected the request. No replacement request was sent.');
        } catch { /* Keep the immutable intent if durable cleanup could not be confirmed. */ }
      }
      patch({ pending: { kind: pending.kind, status: 'unknown' } });
      return result(false, 'UNKNOWN', 'Acknowledgement unknown. Original request saved; /recover explicitly replays it once.');
    }
  }
  const handlers: { [K in Command['type']]: (command: Extract<Command, { type: K }>) => Promise<CommandResult> } = {
    help: async () => { patch({ view: 'help' }); return result(true, 'HELP', commandDescriptors.map(entry => `${entry.usage} — ${entry.description}`).join('\n')); },
    conversations: async command => {
      const version = epoch; const page = await client.conversations({ after: command.after, limit: 6 }, connection.signal);
      if (!current(version)) return result(false, 'STALE', 'Old observation ignored.');
      if (page.conversations.length > 6) throw new LocalError('INVALID_RESPONSE', 'List limit exceeded.');
      patch({ connected: true, view: 'conversations', conversations: page.conversations.map(item => ({ id: item.id, title: item.title })), conversationCursor: page.nextCursor });
      return result(true, 'CONVERSATIONS', 'Conversation page loaded.');
    },
    profiles: async command => {
      const version = epoch; const page = await client.executionProfiles({ after: command.after, limit: 6 }, connection.signal);
      if (!current(version)) return result(false, 'STALE', 'Old observation ignored.');
      if (page.profiles.length > 6) throw new LocalError('INVALID_RESPONSE', 'Profile limit exceeded.');
      profiles = page.profiles;
      patch({ view: 'profiles', profiles: profiles.map(profile => ({ id: profile.reference.id, model: profile.model.value, access: profile.configuration.access, availability: 'not-probed' })), profileCursor: page.nextCursor });
      return result(true, 'PROFILES', 'Configured profiles loaded; provider availability has not been probed.');
    },
    open: async command => {
      requireFree(); rotate(); const version = epoch;
      patch({ view: 'conversation', selected: null, turns: [], connected: false }); await refresh(command.id, version); schedule();
      if (!current(version)) return result(false, 'STALE', 'Old observation ignored.');
      return result(true, 'OPENED', 'Saved conversation opened.');
    },
    new: async command => {
      requireFree();
      const profile = command.profileId ? profiles.find(item => item.reference.id === command.profileId) : undefined;
      if (command.profileId && !profile) throw new LocalError('PROFILE_NOT_LOADED', 'Use /profiles to load the page containing this profile.');
      if (profile && !['none', 'configured-readonly'].includes(profile.configuration.access)) throw new LocalError('UNSUPPORTED_PROFILE', 'This profile is not for ordinary conversations.');
      const input = conversationCreationSchema.parse({ title: command.title, ...(profile ? { executionProfile: profile.reference,
        requested: { model: profile.configuration.model, thinking: 'disabled', tools: profile.configuration.access === 'none' ? 'none' : 'configured-readonly' } } : {}) });
      return mutate(intentSchema.parse({ version: 1, connectionId: options.connectionId, key: (options.makeKey ?? randomUUID)(), kind: 'create', input }), false);
    },
    send: async command => {
      requireFree(); if (!state.selected) throw new LocalError('NO_CONVERSATION', 'Create or open a conversation first.');
      const input = conversationTurnSchema.parse({ expectedRevision: state.selected.revision, text: command.text, mode: 'follow-up' });
      return mutate(intentSchema.parse({ version: 1, connectionId: options.connectionId, key: (options.makeKey ?? randomUUID)(), kind: 'send', conversationId: state.selected.id, input }), false);
    },
    recover: async () => {
      rotate();
      if (intent) return mutate(intent, true);
      if (!state.selected) return handlers.conversations({ type: 'conversations' });
      const version = epoch; await refresh(state.selected.id, version);
      if (!current(version)) return result(false, 'STALE', 'Old observation ignored.');
      patch({ view: 'conversation' }); schedule(); return result(true, 'RECOVERED', 'Center history reloaded.');
    },
    disconnect: async () => { disconnect(); return result(true, 'DISCONNECTED', 'Observation stopped. Center work is not cancelled.'); },
    quit: async () => { await dispose(); return result(true, 'QUIT', 'Terminal closed. Center work is not cancelled.'); },
  };
  function disconnect() { rotate(); patch({ connected: false, notice: 'Disconnected; center work continues.', ...(intent ? { pending: { kind: intent.kind, status: 'unknown' } } : {}) }); }
  function dispose(): Promise<void> {
    if (disposed) return disposed;
    disconnect(); patch({ closed: true }); listeners.clear();
    disposed = (async () => { await activeMutation?.then(() => undefined, () => undefined); })(); return disposed;
  }
  async function execute(raw: Command): Promise<CommandResult> {
    if (!initialized) return result(false, 'NOT_INITIALIZED', 'Initialize interaction first.');
    let command: Command;
    try { command = commandSchema.parse(raw); } catch { return result(false, 'INVALID_COMMAND', 'Invalid or unsupported command arguments.'); }
    if (command.type === 'quit' || command.type === 'disconnect') return handlers[command.type](command as never);
    if (state.closed) return result(false, 'CLOSED', 'This terminal is closed.');
    if (state.busy) return result(false, 'BUSY', 'Another command is still pending.');
    patch({ busy: true });
    try {
      const answer = await handlers[command.type](command as never); if (!state.closed) patch({ notice: answer.message }); return answer;
    } catch (error) {
      const answer = error instanceof LocalError ? result(false, error.code, error.message)
        : result(false, error instanceof FlowApiError ? `HTTP_${error.status}` : 'READ_FAILED', 'Request failed. No automatic mutation retry was performed.');
      if (!state.closed) patch({ notice: answer.message, ...(['recover', 'open'].includes(command.type) ? { connected: false } : {}) }); return answer;
    } finally { if (!state.closed) patch({ busy: false }); }
  }
  return {
    async initialize() {
      if (initialized) return;
      const stored = await intents.load();
      if (stored) { intent = freeze(intentSchema.parse(stored)); if (intent.connectionId !== options.connectionId) throw new Error('Saved intent belongs to another connection.');
        patch({ pending: { kind: intent.kind, status: 'unknown' }, notice: 'Unresolved saved request. Use /recover; no request has been sent.' }); }
      initialized = true;
    },
    execute,
    async input(text) { try { return await execute(parseInput(text)); } catch { return result(false, 'INVALID_COMMAND', 'Invalid input. Use /help.'); } },
    setDraft(text) { if (text.length > 16_000 || Buffer.byteLength(text, 'utf8') > 64 * 1024) { patch({ notice: 'Input limit: 16,000 characters / 64 KiB.' }); return false; } patch({ draft: text }); return true; },
    snapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    disconnect, dispose,
  };
}
