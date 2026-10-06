import type { IncomingMessage, ServerResponse } from "node:http";
import { startContextPreview } from "./conversation-context-integration.fixture";

export interface LifecycleRead {
  id: number; method: string; path: string; startedAt: number;
  handledAt?: number; finishedAt?: number; closedAt?: number; delayed: boolean;
}

/** Instrument only the simulated HTTP server. App, private stores and runtime remain untouched. */
export async function startLifecycleFixture() {
  const preview = await startContextPreview();
  const reads: LifecycleRead[] = [], timers = new Set<ReturnType<typeof setTimeout>>();
  let nextDelay: { path: string; ms: number } | null = null, closed = false;
  const fixture = preview.first;
  for (let n = 9; n <= 32; n++) {
    const id = `chat-${n}`, model = structuredClone(fixture.chats.get("chat-3")!);
    model.snapshot.conversation = { ...model.snapshot.conversation, id, title: `Conversation ${n}`, revision: 0 };
    model.snapshot.lastTurn = null; model.turns = [];
    fixture.chats.set(id, model); fixture.addTurn(id, `Lifecycle sample ${n}`, true);
  }
  for (const chat of fixture.chats.values()) chat.snapshot.conversation.projectId = "project-01";
  const handler = fixture.server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  fixture.server.on("request", (req, res) => {
    const row: LifecycleRead = { id: reads.length, method: req.method ?? "GET", path: req.url ?? "/", startedAt: Date.now(), delayed: false };
    reads.push(row);
    res.once("finish", () => { row.finishedAt = Date.now(); });
    res.once("close", () => { row.closedAt = Date.now(); });
    const route = () => { row.handledAt = Date.now(); if (!closed) handler(req, res); };
    if (nextDelay && row.method === "GET" && row.path === nextDelay.path) {
      row.delayed = true; const delay = nextDelay.ms; nextDelay = null;
      const timer = setTimeout(() => { timers.delete(timer); route(); }, delay); timers.add(timer);
    } else route();
  });
  return {
    ...preview, reads,
    delayNextRead(path: string, ms = 900) { nextDelay = { path, ms }; },
    close: async () => { closed = true; timers.forEach(clearTimeout); await preview.close(); },
  };
}
