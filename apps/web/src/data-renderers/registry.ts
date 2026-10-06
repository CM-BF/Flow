import type { ComponentType } from "react";
import type { PluginHost } from "../plugins/host";
import type { Disposable, PluginContext } from "../plugins/types";

export const FLOW_REPLY_NAME = "flow-reply-detail";
export const FLOW_REPLY_OWNER = "flow.reply-detail";
export type DataRenderer = ComponentType<{ data: unknown }>;
export interface DataDeclaration {
  readonly ownerId: string;
  readonly name: string;
  readonly version: number;
  /** Must validate and return a detached value; no I/O or privileges. */
  readonly parse: (data: unknown) => unknown;
}
type Attachment = { token: symbol; render: DataRenderer; signal: AbortSignal; generation: number; cleanup?: () => void };
export type Resolution =
  | { kind: "unknown"; reason: string }
  | { kind: "invalid"; reason: string }
  | { kind: "unavailable"; reason: string; data: unknown }
  | { kind: "ready"; data: unknown; render: DataRenderer; generation: number };
type Lifecycle = Pick<PluginHost, "list" | "subscribe">;

function validateCatalog(input: readonly DataDeclaration[]) {
  const issues = new Set<string>();
  const names = new Set<string>();
  for (const item of input) {
    if (names.has(item.name)) issues.add(`Duplicate data name: ${item.name}`);
    names.add(item.name);
    if (!/^[a-z][a-z0-9.-]*$/.test(item.name) || !/^[a-z][a-z0-9.-]*$/.test(item.ownerId)) issues.add("Invalid data renderer identity");
    if (/^flow(?:[.-]|$)/.test(item.name)) {
      if (item.name !== FLOW_REPLY_NAME || item.ownerId !== FLOW_REPLY_OWNER || item.version !== 1) issues.add(`Reserved Flow data name: ${item.name}`);
    } else if (!item.name.startsWith(`${item.ownerId}.`)) issues.add(`Data name must belong to owner: ${item.name}`);
    if (!Number.isSafeInteger(item.version) || item.version < 1 || typeof item.parse !== "function") issues.add(`Invalid data declaration: ${item.name}`);
  }
  if (issues.size) throw new Error([...issues].sort().join("; "));
  return Object.freeze(input.map(item => Object.freeze({ ...item })).sort((a, b) => a.name.localeCompare(b.name)));
}

/** A build-time catalogue and P01-owned attachments, never a second enable/grant authority. */
export function createDataRendererRegistry(declarations: readonly DataDeclaration[], host: Lifecycle) {
  const catalog = validateCatalog(declarations);
  const byName = new Map(catalog.map(item => [item.name, item]));
  const attached = new Map<string, Attachment>();
  const listeners = new Set<() => void>();
  const diagnostics: string[] = [];
  let revision = 0, generation = 0, disposed = false;
  const publish = () => { revision++; for (const listener of listeners) { try { listener(); } catch (error) { diagnostics.push(error instanceof Error ? error.message : String(error)); } } };
  const unsubscribe = host.subscribe(publish);
  const registry = {
    catalog,
    getDiagnostics: () => Object.freeze([...diagnostics]),
    getSnapshot: () => revision,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Called only by the trusted owner loader with its existing PluginContext. */
    attach(ownerId: string, name: string, render: DataRenderer, context: Pick<PluginContext, "signal" | "own">): Disposable {
      if (disposed || context.signal.aborted) throw new Error("Renderer lifetime ended");
      if (byName.get(name)?.ownerId !== ownerId) throw new Error("Renderer owner does not match declaration");
      if (attached.has(name)) throw new Error(`Renderer already attached: ${name}`);
      if (typeof render !== "function") throw new Error("Renderer must be a trusted React component");
      const entry: Attachment = { token: Symbol(name), render, signal: context.signal, generation: ++generation };
      attached.set(name, entry);
      const cleanup = { dispose: () => {
        context.signal.removeEventListener("abort", cleanup.dispose);
        if (attached.get(name)?.token === entry.token) { attached.delete(name); publish(); }
      } };
      entry.cleanup = cleanup.dispose;
      context.signal.addEventListener("abort", cleanup.dispose, { once: true });
      try { context.own(cleanup); } catch (error) { cleanup.dispose(); throw error; }
      publish(); return cleanup;
    },
    resolve(name: string, input: unknown): Resolution {
      const declaration = byName.get(name);
      if (!declaration) return { kind: "unknown", reason: "No trusted renderer for this data type" };
      let data: unknown;
      try {
        const version = input && typeof input === "object" && "version" in input ? input.version : name === FLOW_REPLY_NAME ? 1 : undefined;
        if (version !== declaration.version) return { kind: "invalid", reason: "Unsupported data version" };
        data = declaration.parse(input);
      } catch { return { kind: "invalid", reason: "Data does not match the renderer schema" }; }
      const entry = attached.get(name);
      if (disposed || !entry || entry.signal.aborted || host.list().find(item => item.id === declaration.ownerId)?.state !== "active")
        return { kind: "unavailable", reason: "Enhanced display is unavailable", data };
      return { kind: "ready", data, render: entry.render, generation: entry.generation };
    },
    dispose() {
      if (disposed) return;
      disposed = true; unsubscribe(); for (const entry of [...attached.values()]) entry.cleanup?.(); publish(); listeners.clear();
    },
  };
  return registry;
}
export type DataRendererRegistry = ReturnType<typeof createDataRendererRegistry>;
