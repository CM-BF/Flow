import { FlowApiError, type FlowClient } from '@flow/client';
import { pluginRuntimeCommandSchema, type PluginRuntimeCommand } from '@flow/contracts';

export type PluginRuntimeReader = Pick<FlowClient, 'pluginRuntime' | 'pluginMaterialInstalls'>;
type RuntimeWriter = Pick<FlowClient, 'commandPluginRuntime'>;
type RuntimeAcknowledgement = Awaited<ReturnType<RuntimeWriter['commandPluginRuntime']>>;
export type FrozenRuntimeCommand = Readonly<{
  registrationId: string;
  input: PluginRuntimeCommand;
  key: string;
  body: string;
}>;
export type RuntimeCommandState = Readonly<{
  phase: 'idle' | 'sending' | 'unknown' | 'rejected' | 'accepted' | 'revoked';
  command?: FrozenRuntimeCommand;
  acknowledgement?: RuntimeAcknowledgement;
  rejectionStatus?: number;
  retryRejectionStatus?: number;
  notice?: 'invalid-input' | 'unverified-response' | 'session-ended';
}>;
export interface RuntimeSessionAuthority {
  readonly sessionId: string;
  /** Must consult the live host session, not the render that opened Settings. */
  isCurrent(): boolean;
}

/** One unresolved runtime command per host session. The view does not own its lifetime. */
export function createRuntimeCommandController(
  writer: RuntimeWriter,
  authority: RuntimeSessionAuthority,
  createKey: () => string = () => crypto.randomUUID(),
) {
  let active = true;
  let state: RuntimeCommandState = Object.freeze({ phase: 'idle' });
  let flight: AbortController | undefined;
  const listeners = new Set<() => void>();
  const current = () => active && authority.isCurrent();
  function publish(next: RuntimeCommandState) {
    state = Object.freeze(next);
    // Observer failures cannot turn an accepted write into a reported rejection.
    for (const listener of listeners) { try { listener(); } catch { /* State remains authoritative. */ } }
  }
  function revoke() {
    if (!active) return;
    active = false;
    flight?.abort();
    publish({ ...state, phase: 'revoked', notice: 'session-ended' });
  }
  function requireCurrent() {
    if (current()) return true;
    revoke();
    return false;
  }
  async function dispatch(command: FrozenRuntimeCommand, recoveringUnknown: boolean) {
    if (!requireCurrent()) return;
    const controller = new AbortController();
    flight = controller;
    publish({ phase: 'sending', command });
    if (!requireCurrent()) return;
    let next: RuntimeCommandState;
    try {
      const acknowledgement = await writer.commandPluginRuntime(command.registrationId, command.input, command.key, controller.signal);
      next = { phase: 'accepted', command, acknowledgement };
    } catch (error) {
      const rejected = error instanceof FlowApiError && error.status >= 400 && error.status < 500
        && error.code !== 'http_error' && error.code.length > 0;
      // A rejection of a retry cannot disprove the original unknown write.
      next = recoveringUnknown || !rejected
        ? { phase: 'unknown', command, notice: 'unverified-response', ...(rejected ? { retryRejectionStatus: error.status } : {}) }
        : { phase: 'rejected', command, rejectionStatus: error.status };
    }
    if (flight === controller) flight = undefined;
    if (!requireCurrent() || state.command !== command || state.phase !== 'sending') return;
    publish(next);
  }
  return {
    sessionId: authority.sessionId,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    submit(registrationId: string, candidate: PluginRuntimeCommand): Promise<void> {
      if (!requireCurrent() || state.phase === 'sending' || state.phase === 'unknown') return Promise.resolve();
      let command: FrozenRuntimeCommand;
      try {
        // Use the public schema before taking write authority; invalid input was not sent.
        const parsed = pluginRuntimeCommandSchema.parse(candidate);
        if (!registrationId.trim()) throw new TypeError('Missing registration identity');
        const key = createKey();
        if (!key.trim() || key.length > 200) throw new TypeError('Invalid command key');
        const input = Object.freeze({ ...parsed, change: Object.freeze(parsed.change) });
        command = Object.freeze({ registrationId, input, key, body: JSON.stringify(input) });
      } catch {
        publish({ phase: 'idle', notice: 'invalid-input' });
        return Promise.resolve();
      }
      return dispatch(command, false);
    },
    retryOriginal(expected: FrozenRuntimeCommand): Promise<void> {
      if (!requireCurrent() || state.phase !== 'unknown' || state.command !== expected) return Promise.resolve();
      return dispatch(expected, true);
    },
    revoke,
  };
}
export type RuntimeCommandController = ReturnType<typeof createRuntimeCommandController>;
