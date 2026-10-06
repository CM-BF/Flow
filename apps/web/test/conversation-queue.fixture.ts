import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, preview as productionPreview } from "vite";
import { conversationQueueEnqueueSchema, type ConversationQueueItem, type ConversationQueuePage } from "@flow/contracts";
import { createConversationFixture } from "./conversation.fixture";
import { profileFixture } from "./execution-profile-integration.fixture";

/** Deterministic public HTTP fixture; promotion is simulated only when the test asks. */
function queueCenter(label: "A" | "B") {
  const fixture = createConversationFixture(); fixture.setReplyDelay(600000);
  const handler = fixture.server.listeners("request")[0] as (request: IncomingMessage, response: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const queues = new Map<string, { revision: number; paused: boolean; items: (ConversationQueueItem & { text: string })[] }>();
  const receipts = new Map<string, { body: string; value: object }>();
  let lose: string | null = null, failReads = false, promoteBeforeCancel = false;
  const state = (id: string) => { if (!queues.has(id)) queues.set(id, { revision: 1, paused: false, items: [] }); return queues.get(id)!; };
  const current = (id: string) => { const turn = fixture.chats.get(id)?.snapshot.lastTurn; if (!turn) return null; return { taskId: turn.task.id, taskStatus: fixture.tasks.get(turn.task.id)!.status, turnId: turn.id, turnNumber: turn.number, queueItemId: state(id).items.find(item => item.promoted?.taskId === turn.task.id)?.id ?? null }; };
  const snapshot = (id: string): Omit<ConversationQueuePage, "items" | "nextCursor"> => { const value = state(id), task = current(id); return { conversationId: id, queueRevision: value.revision, paused: value.paused, currentTurn: task, blocked: value.paused ? "queue-paused" : task && !["succeeded", "failed", "cancelled"].includes(task.taskStatus) && value.items.some(item => item.state === "waiting") ? "previous-turn-active" : task?.taskStatus === "failed" ? "previous-turn-failed" : null }; };
  const add = (id: string, text: string) => { const value = state(id); value.revision++; const at = new Date().toISOString(); const entry = { id: `${id}-queued-${value.revision}`, conversationId: id, sequence: value.revision, state: "waiting" as const, preview: text.slice(0,100), truncated: text.length > 100, promoted: null, text, createdAt: at, updatedAt: at }; value.items.push(entry); return entry; };
  const promote = (id: string) => { const value = state(id), entry = value.items.find(item => item.state === "waiting"); if (!entry) return null; const turn = fixture.addTurn(id, entry.text, true); entry.state = "promoted"; entry.promoted = { taskId: turn.task.id, turnId: turn.id, turnNumber: turn.number }; entry.updatedAt = new Date().toISOString(); value.revision++; return entry; };
  const setCurrentStatus = (id: string, status: "running" | "succeeded" | "failed" | "cancelled") => { const turn = fixture.chats.get(id)!.snapshot.lastTurn!; turn.task.status = status; fixture.tasks.get(turn.task.id)!.status = status; };
  for (let i = 0; i < 25; i++) add("chat-1", `${label} waiting message ${i + 1} ` + "long content ".repeat(i ? 1 : 35));
  setCurrentStatus("chat-2", "running");
  fixture.server.on("request", async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    response.setHeader("access-control-allow-origin", "*"); response.setHeader("access-control-allow-headers", "authorization,content-type,idempotency-key");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    const json = (value: unknown, status = 200) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };
    if (url.pathname === "/api/execution-profiles") { json({ profiles: [profileFixture(1, label)], nextCursor: null }); return; }
    const match = /^\/api\/conversations\/([^/]+)\/queue(?:\/(.*))?$/.exec(url.pathname);
    if (!match) {
      if (url.pathname.startsWith("/api/conversations")) {
        const end = response.end.bind(response); response.end = ((chunk: unknown) => {
          try { const value = JSON.parse(String(chunk)); if (value.capabilities) value.capabilities.queue = !url.pathname.startsWith("/api/conversations/chat-8"); return end(JSON.stringify(value)); } catch { return end(chunk as string); }
        }) as typeof response.end;
      }
      handler(request, response); return;
    }
    const id = decodeURIComponent(match[1]!), suffix = match[2] ?? "", value = state(id);
    let body = ""; for await (const chunk of request) body += String(chunk); const key = String(request.headers["idempotency-key"] ?? "");
    fixture.requests.push({ method: request.method ?? "GET", path: request.url!, key, body });
    const error = (code: string, status = 409) => json({ error: { code, message: `Fixture ${code}` } }, status);
    if (request.headers.authorization !== "Bearer flow-fixture-only") { error("unauthorized",401); return; }
    if (request.method === "GET") {
      if (failReads) { error("unavailable",503); return; }
      if (suffix) { const item = value.items.find(item => item.id === suffix); if (!item) error("not_found",404); else json({ ...snapshot(id), item }); return; }
      const after = Number(url.searchParams.get("after") ?? 0), all = value.items.filter(item => item.state === "waiting" && item.sequence > after), limit = Number(url.searchParams.get("limit") ?? 20);
      json({ ...snapshot(id), items: all.slice(0,limit).map(({ text: _text, ...item }) => item), nextCursor: all.length > limit ? all[limit - 1]!.sequence : null }); return;
    }
    const digest = `${url.pathname}:${body}`;
    if (receipts.has(key)) { const receipt = receipts.get(key)!; if (receipt.body !== digest) error("idempotency_conflict"); else json({ ...receipt.value, replayed: true }); return; }
    const input = JSON.parse(body);
    if (suffix.endsWith("/cancel") && promoteBeforeCancel) { promoteBeforeCancel = false; promote(id); }
    const alreadyFinished = suffix.endsWith("/cancel") && value.items.find(item => item.id === suffix.replace(/\/cancel$/, ""))?.state !== "waiting";
    if (!alreadyFinished && input.expectedQueueRevision !== value.revision) { error("conversation_queue_revision_conflict"); return; }
    let result: object, kind: string;
    if (!suffix) {
      const parsed = conversationQueueEnqueueSchema.safeParse(input); if (!parsed.success) { error("invalid_input",400); return; }
      const { text: _text, ...item } = add(id, parsed.data.text); result = { conversationId: id, queueRevision: value.revision, item }; kind = "enqueue";
    } else if (suffix === "pause") {
      if (!value.paused) value.revision++; value.paused = true; result = { conversationId: id, queueRevision: value.revision, paused: true, currentTurn: current(id) }; kind = "pause";
    } else if (suffix === "resume") {
      if (input.expectedTaskId !== (current(id)?.taskId ?? null)) { error("conversation_queue_task_conflict"); return; }
      if (current(id)?.taskStatus === "running") { error("conversation_busy"); return; }
      const before = value.revision, promoted = promote(id); value.paused = false; value.revision = before + 1;
      result = { conversationId: id, queueRevision: value.revision, paused: false, currentTurn: current(id), promoted }; kind = "resume";
    } else {
      const itemId = suffix.replace(/\/cancel$/, ""), item = value.items.find(item => item.id === itemId);
      if (!item) { error("not_found",404); return; }
      const outcome = item.state === "promoted" ? "already-promoted" : item.state === "cancelled" ? "already-cancelled" : "cancelled";
      if (item.state === "waiting") { item.state = "cancelled"; item.updatedAt = new Date().toISOString(); value.revision++; }
      result = { conversationId: id, queueRevision: value.revision, item, outcome }; kind = "cancel-item";
    }
    const ack = structuredClone({ ...result, replayed: false }); receipts.set(key, { body: digest, value: ack });
    if (lose === kind) { lose = null; request.socket.destroy(); } else json(ack);
  });
  return { ...fixture, queues, addQueued: add, promote, setCurrentStatus, promoteOnNextCancel() { promoteBeforeCancel = true; }, loseNext(kind: string) { lose = kind; }, failQueueReads(value: boolean) { failReads = value; }, replaceCurrent(id: string) { const turn = fixture.addTurn(id, `${label} replacement`, false); return turn.task.id; } };
}

export async function startQueuePreview(production = false) {
  const first = queueCenter("A"), second = queueCenter("B"), centers: string[] = [];
  for (const fixture of [first,second]) { await new Promise<void>(resolve => fixture.server.listen(0,"127.0.0.1",resolve)); const address = fixture.server.address(); if (!address || typeof address === "string") throw Error("Missing center"); centers.push(`http://127.0.0.1:${address.port}`); }
  const root = fileURLToPath(new URL("..",import.meta.url)), proxy = { "/api": centers[0]! };
  const server = production ? await productionPreview({ root, preview: { host: "127.0.0.1", port: 0, proxy } }) : await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy } });
  if ("listen" in server) await server.listen(); const address = server.httpServer!.address(); if (!address || typeof address === "string") throw Error("Missing preview");
  return { first, second, centers, url: `http://127.0.0.1:${address.port}`, close: async () => { await server.close(); await Promise.all([first.close(),second.close()]); } };
}
if (process.argv.includes("--queue-preview")) {
  const preview = await startQueuePreview(); console.log(`Queue HTTP fixture (no model/DB): ${preview.url}`); console.log(`Centers ${preview.centers.join(", ")} · public token flow-fixture-only`);
  const stop = async () => { await preview.close(); process.exit(); }; process.once("SIGINT",stop); process.once("SIGTERM",stop);
}
