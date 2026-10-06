import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuiState } from "@assistant-ui/react";
import type { Readable } from "../plugins/types";
import { FLOW_REPLY_NAME, FLOW_REPLY_OWNER, type DataDeclaration } from "./registry";
import { defaultDataFallback } from "./react";

export interface ReplyIdentity {
  readonly connectionId: string;
  readonly viewId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly turnId: string;
  readonly taskId: string;
  /** Existing projection's version/digest/reference identity, not just turn id. */
  readonly detailKey: string;
}
export interface ReplySnapshot { readonly loading?: boolean; readonly error?: string; readonly content?: string }
export interface ReplyPort extends Readable<ReplySnapshot> {
  readonly identity: ReplyIdentity;
  isCurrent(): boolean;
  read(): Promise<void>;
}
const expired: ReplySnapshot = Object.freeze({ error: "This reply is no longer available in this view." });
/** Host supplies authorized, identity-bound state/load. No client, token, or arbitrary ID is exposed. */
export function createReplyPort(options: { identity: ReplyIdentity; signal: AbortSignal; current: () => boolean; source: Readable<ReplySnapshot>; load: () => Promise<void> }): ReplyPort {
  const identity = Object.freeze({ ...options.identity });
  if (Object.values(identity).some(value => typeof value !== "string" || !value)) throw new Error("Incomplete reply identity");
  const current = () => !options.signal.aborted && options.current();
  return Object.freeze({ identity, isCurrent: current,
    getSnapshot: () => current() ? options.source.getSnapshot() : expired,
    subscribe: (listener: () => void) => {
      const remove = options.source.subscribe(listener);
      options.signal.addEventListener("abort", listener);
      return () => { remove(); options.signal.removeEventListener("abort", listener); };
    },
    read: async () => { if (!current()) throw new Error(expired.error); await options.load(); if (!current()) throw new Error(expired.error); },
  });
}
export interface ReplyBindings {
  readonly connectionId: string;
  readonly viewId: string;
  /** Returns only the authorized current assistant-message/turn/task binding, or null. */
  bind(messageId: string, turnId: string): ReplyPort | null;
}
const Bindings = createContext<{ bindings: ReplyBindings; disclosure: Map<string, boolean> } | null>(null);
export function ReplyBindingsProvider({ value, children }: { value: ReplyBindings; children: ReactNode }) {
  const context = useMemo(() => ({ bindings: value, disclosure: new Map<string, boolean>() }), [value]);
  return <Bindings.Provider value={context}>{children}</Bindings.Provider>;
}
function parseReply(data: unknown): Readonly<{ turnId: string; version: 1 }> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid reply data");
  const record = data as Record<string, unknown>;
  if (Object.keys(record).some(key => key !== "turnId" && key !== "version") || typeof record.turnId !== "string" || !record.turnId || record.turnId.length > 128 || (record.version !== undefined && record.version !== 1)) throw new Error("Invalid reply data");
  return Object.freeze({ turnId: record.turnId, version: 1 });
}
export const flowReplyDeclaration: DataDeclaration = Object.freeze({ ownerId: FLOW_REPLY_OWNER, name: FLOW_REPLY_NAME, version: 1, parse: parseReply });

function BoundReply({ port, disclosure, identity }: { port: ReplyPort; disclosure: Map<string, boolean>; identity: string }) {
  const state = useSyncExternalStore(port.subscribe, port.getSnapshot);
  const [expanded, setExpanded] = useState(() => disclosure.get(identity) ?? false), [error, setError] = useState<string>();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const read = async () => {
    setError(undefined);
    try { await port.read(); } catch (cause) { if (mounted.current && port.isCurrent()) setError(cause instanceof Error ? cause.message : "Reply could not be read"); }
  };
  return <div className="flow-reply-detail"><p>This reply is shortened.</p><button className="flow-link" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); disclosure.set(identity, !expanded); if (!expanded) void read(); }}>{expanded ? "Hide full reply" : "Read full reply"}</button>
    {expanded && <div>{state.loading && <p role="status">Loading full reply…</p>}{(state.error || error) && <p role="alert">{state.error || error} <button className="flow-link" onClick={() => void read()}>Retry reply</button></p>}{state.content !== undefined && <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{state.content}</pre>}</div>}
  </div>;
}
export function FlowReplyDetail({ data }: { data: unknown }) {
  const context = useContext(Bindings);
  const bindings = context?.bindings;
  const message = useAuiState(state => state.message);
  const parsed = parseReply(data);
  const port = message.role === "assistant" ? bindings?.bind(message.id, parsed.turnId) : null;
  if (!port || !port.isCurrent() || port.identity.connectionId !== bindings?.connectionId || port.identity.viewId !== bindings.viewId || port.identity.messageId !== message.id || port.identity.turnId !== parsed.turnId)
    return <p role="note">This reply detail is not available for this message. The message above remains available.</p>;
  const identity = JSON.stringify(port.identity);
  return <BoundReply key={identity} port={port} identity={identity} disclosure={context!.disclosure} />;
}
/** Only validated legacy Flow data keeps its existing host-authorized read path during fallback. */
export const flowReplyFallback = (part: { name: string; data: unknown }, reason: string, validated: boolean) => part.name === FLOW_REPLY_NAME && validated
  ? <div><p role="note">{reason}. Using the standard reply display.</p><FlowReplyDetail data={part.data} /></div>
  : defaultDataFallback(part, reason, validated);
