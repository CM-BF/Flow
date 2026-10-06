import { Component, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAui } from "@assistant-ui/react";
import type { DataRendererRegistry } from "./registry";

type Part = { name: string; data: unknown };
type Fallback = (part: Part, reason: string, validated: boolean) => ReactNode;
/** Diagnostic preview only: never stringify or walk the whole untrusted payload. */
export function summarizeData(input: unknown): string {
  const seen = new WeakSet<object>();
  let remaining = 4096, nodes = 0;
  const chunks: string[] = [];
  const append = (text: string) => { const part = text.slice(0, remaining); chunks.push(part); remaining -= part.length; };
  const walk = (value: unknown, depth: number) => {
    if (!remaining) return;
    if (++nodes > 48) { append("[node limit]"); return; }
    if (typeof value === "string") { append(JSON.stringify(value.slice(0, 512))); if (value.length > 512) append("…[string truncated]"); return; }
    if (value === null || typeof value !== "object") { append(String(value).slice(0, 128)); return; }
    if (seen.has(value)) { append("[circular]"); return; }
    if (depth >= 3) { append("[depth limit]"); return; }
    seen.add(value); const array = Array.isArray(value); append(array ? "[" : "{");
    let count = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (count++ >= 8 || nodes >= 48 || !remaining) { append("…[items truncated]"); break; }
      if (count > 1) append(", ");
      if (!array) append(JSON.stringify(key.slice(0, 128)) + ": ");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) walk(descriptor.value, depth + 1);
      else append("[accessor omitted]");
    }
    append(array ? "]" : "}");
  };
  try { walk(input, 0); } catch { append("[unreadable]"); }
  return chunks.join("") + (remaining ? "" : "…[output limit]");
}
export const defaultDataFallback: Fallback = (part, reason) => <div role="note"><p>{reason}. The message above remains available.</p><details><summary>Message data · {part.name.slice(0, 128)}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{summarizeData(part.data)}</pre></details></div>;

class RenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Mount once in each isolated AssistantRuntimeProvider, replacing legacy named registrations. */
export function AssistantDataRenderers({ registry, fallback = defaultDataFallback }: { registry: DataRendererRegistry; fallback?: Fallback }) {
  const aui = useAui();
  const Wrapper = useMemo(() => function BoundDataRenderer(part: Part) {
    useSyncExternalStore(registry.subscribe, registry.getSnapshot);
    const resolution = registry.resolve(part.name, part.data);
    if (resolution.kind === "unknown" || resolution.kind === "invalid") return fallback(part, resolution.reason, false);
    const safePart = { name: part.name, data: resolution.data };
    const recovery = fallback(safePart, "Enhanced display failed or is disabled", true);
    if (resolution.kind === "unavailable") return recovery;
    const Render = resolution.render;
    return <RenderBoundary key={resolution.generation} fallback={recovery}><Render data={resolution.data} /></RenderBoundary>;
  }, [registry, fallback]);
  useEffect(() => {
    const cleanups = registry.catalog.map(item => aui.dataRenderers.setDataUI(item.name, Wrapper));
    cleanups.push(aui.dataRenderers.setFallbackDataUI(Wrapper));
    return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
  }, [aui, registry, Wrapper]);
  return null;
}
