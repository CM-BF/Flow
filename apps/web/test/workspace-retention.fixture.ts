import type { IncomingMessage, ServerResponse } from "node:http";
import { startContextPreview } from "./conversation-context-integration.fixture";

/** Observe only the simulated transport. No access to App maps or private runtime state. */
export async function startRetentionFixture() {
  const preview = await startContextPreview(), fixture = preview.first;
  const reads: { path: string; method: string; at: number; delayed: boolean; cancelled?: boolean }[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let nextDelay: string | null = null;
  for (let n = 9; n <= 33; n++) {
    const id = `chat-${n}`, model = structuredClone(fixture.chats.get("chat-3")!);
    model.snapshot.conversation = { ...model.snapshot.conversation, id, title: `Conversation ${n}`, revision: 0 };
    model.snapshot.lastTurn = null; model.turns = []; fixture.chats.set(id, model);
    fixture.addTurn(id, `Cache sample ${n}`, true);
  }
  for (const chat of fixture.chats.values()) chat.snapshot.conversation.projectId = "project-01";
  for (let n = 2; n <= 24; n++) fixture.addTurn("chat-6", `History ${n}`, true);
  const handler = fixture.server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  fixture.server.removeAllListeners("request");
  fixture.server.on("request", (req, res) => {
    const row = { path: req.url ?? "/", method: req.method ?? "GET", at: Date.now(), delayed: false, cancelled: false }; reads.push(row);
    const run = () => {
      if (res.destroyed || req.destroyed) { row.cancelled = true; return; }
      Promise.resolve(handler(req, res)).catch(error => { if (!res.destroyed) { res.writeHead(500); res.end(JSON.stringify({ error: String(error) })); } });
    };
    if (req.method === "GET" && row.path === nextDelay) {
      row.delayed = true; nextDelay = null;
      const timer = setTimeout(() => { timers.delete(timer); run(); }, 700); timers.add(timer);
    } else run();
  });
  return { ...preview, transport: reads, delayNext(path: string) { nextDelay = path; }, close: async () => { timers.forEach(clearTimeout); await preview.close(); } };
}
