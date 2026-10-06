import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, preview as serveProduction } from "vite";
import { conversationCreationSchema, conversationTurnSchema, type ConversationSnapshot, type ConversationTurn, type ConversationTurnAccepted, type TaskSnapshot } from "@flow/contracts";
import { createWorkspaceFixture } from "./workspace-fixture";
const capabilities = { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } as const;
/** Public FlowClient protocol fixture; no center, SDK, or model is executed. */
export function createConversationFixture() {
  const fixture = createWorkspaceFixture();
  const original = fixture.server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const chats = new Map<string, { snapshot: ConversationSnapshot; turns: ConversationTurn[] }>();
  const receipts = new Map<string, { body: string; value: unknown }>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let loseReceipt = false, failReads = false, conflict = false;
  let ackDelay = 0, replyDelay = 100;
  const schedule = (fn: () => void, ms: number) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); };
  const create = (id: string, title: string) => {
    const at = new Date().toISOString();
    const value = { snapshot: { conversation: { id, title, harness: "claude" as const, requested: { model: "runner-default", thinking: "disabled" as const, tools: "configured-readonly" as const }, revision: 0, createdAt: at, updatedAt: at }, capabilities, nativeSession: null, lastTurn: null } as ConversationSnapshot, turns: [] as ConversationTurn[] };
    chats.set(id, value); return value;
  };
  const addTurn = (id: string, text: string, complete = false) => {
    const chat = chats.get(id)!; const number = chat.turns.length + 1; const taskId = `${id}-task-${number}`; const at = new Date().toISOString();
    const template = fixture.tasks.get("demo-completed")!;
    const task: TaskSnapshot = { ...structuredClone(template), id: taskId, title: text.slice(0, 80), prompt: text, harness: "claude", status: "running", verificationStatus: "pending", createdAt: at, updatedAt: at, watermark: 0, entries: [], pendingDecision: null };
    fixture.tasks.set(taskId, task); fixture.append(taskId, "Runner accepted this execution. This is telemetry, not the assistant reply.");
    const turn: ConversationTurn = { id: `${id}-turn-${number}`, conversationId: id, number, createdAt: at, user: { role: "user", text }, task,
      assistant: { state: "pending", reason: "execution-pending" }, effective: { model: null, thinking: "unknown", tools: null, source: null }, telemetry: { kind: "execution", taskId, title: "Execution details" } };
    chat.turns.push(turn); chat.snapshot.conversation = { ...chat.snapshot.conversation, revision: number, updatedAt: at }; chat.snapshot.lastTurn = turn;
    const finish = () => {
      task.status = "succeeded"; task.verificationStatus = "pending"; task.updatedAt = new Date().toISOString();
      const content = text.toLowerCase().includes("long") ? "A thoughtful reply with a longer explanation.\n".repeat(130) : number === 1 ? "Hi! What would you like to talk about?" : `You said “${text}”. We can keep exploring that together.`;
      const detailId = `${taskId}-reply`, messageId = `${taskId}-message`, attemptId = `${taskId}-attempt`;
      fixture.details.set(detailId, { id: detailId, title: "Assistant reply", kind: "detail", content, mediaType: "text/plain" });
      fixture.append(taskId, "Execution ended. Verification is recorded separately.");
      turn.task = { ...task }; turn.assistant = { state: "available", role: "assistant", messageId, text: content.slice(0, 4000), truncated: content.length > 4000,
        contentRef: { id: detailId, title: "Assistant reply", kind: "detail", taskId, attemptId },
        source: { kind: "assistant-final", source: "claude.sdk.result", messageId, taskId, attemptId, nativeSessionId: `${id}-session`, eventId: `${taskId}-event`, sourceMessageId: `${taskId}-source`, contentDigest: createHash("sha256").update(content).digest("hex"), detailId } };
      turn.effective = { model: "simulated-model", thinking: "unknown", tools: ["Read"], permissionMode: "dontAsk", runnerRequested: { model: "runner-default", permissionMode: "dontAsk", thinking: "disabled" }, source: { kind: "assistant-final", messageId, taskId, attemptId, detailId } };
    };
    if (complete) finish(); else schedule(finish, replyDelay);
    return turn;
  };
  for (let i = 1; i <= 8; i++) { create(`chat-${i}`, `Conversation ${i}`); addTurn(`chat-${i}`, i === 1 ? "A long reply please" : "hi", true); }
  fixture.server.on("request", async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/conversations")) { original(req, res); return; }
    res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-headers", "authorization,content-type,idempotency-key");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const json = (value: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
    const error = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
    if (req.headers.authorization !== "Bearer flow-fixture-only") { error(401, "unauthorized", "Fixture token required"); return; }
    let body = ""; for await (const chunk of req) body += String(chunk);
    const key = String(req.headers["idempotency-key"] ?? "");
    fixture.requests.push({ method: req.method ?? "GET", path: req.url!, key, body });
    if (req.method === "GET" && failReads) { error(503, "unavailable", "Simulated connection failure"); return; }
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent); const id = parts[2];
    if (req.method === "POST" && receipts.has(key)) { const receipt = receipts.get(key)!; if (receipt.body !== body) error(409, "idempotency_conflict", "Request changed"); else json({ ...(receipt.value as object), replayed: true }); return; }
    if (parts.length === 2) {
      if (req.method === "GET") { const all = [...chats.values()].map(chat => chat.snapshot.conversation).filter(chat => chat.id > (url.searchParams.get("after") ?? "")).sort((a,b) => a.id.localeCompare(b.id)); const limit = Number(url.searchParams.get("limit") ?? 50); const page = all.slice(0, limit); json({ conversations: page, nextCursor: all.length > limit ? page.at(-1)!.id : null }); return; }
      const input = conversationCreationSchema.safeParse(JSON.parse(body)); if (!input.success) { error(400, "invalid_input", "Invalid conversation"); return; }
      const chat = create(randomUUID(), input.data.title); chat.snapshot.conversation = { ...chat.snapshot.conversation, ...input.data };
      const value = { conversation: chat.snapshot.conversation, capabilities, replayed: false }; receipts.set(key, { body, value }); json(value); return;
    }
    const chat = id && chats.get(id); if (!chat) { error(404, "not_found", "Conversation not found"); return; }
    if (parts.length === 3) { json(chat.snapshot); return; }
    if (parts.length === 7 && parts[5] === "details") { const turn = chat.turns.find(turn => turn.id === parts[4]); const detail = turn?.assistant.state === "available" && turn.assistant.contentRef.id === parts[6] ? fixture.details.get(parts[6]!) : null; if (!detail) error(404, "not_found", "Reply detail not found"); else json(detail); return; }
    if (req.method === "GET") { const after = Number(url.searchParams.get("after") ?? 0), limit = Number(url.searchParams.get("limit") ?? 20); const all = chat.turns.filter(turn => turn.number > after), turns = all.slice(0, limit); json({ conversation: chat.snapshot.conversation, turns, nextCursor: all.length > limit ? turns.at(-1)!.number : null }); return; }
    const input = conversationTurnSchema.safeParse(JSON.parse(body));
    if (!input.success) { error(400, "invalid_input", "Invalid message"); return; }
    if (conflict || input.data.expectedRevision !== chat.snapshot.conversation.revision) { conflict = false; error(409, "conversation_revision_conflict", "Refresh the conversation before sending a new message"); return; }
    if (input.data.mode !== "follow-up") { error(422, "unsupported", "Queue and steering are unavailable"); return; }
    const turn = addTurn(id, input.data.text); const value: ConversationTurnAccepted = structuredClone({ conversation: chat.snapshot.conversation, turn, replayed: false });
    receipts.set(key, { body, value }); if (loseReceipt) { loseReceipt = false; req.socket.destroy(); return; }
    if (ackDelay) schedule(() => json(value), ackDelay); else json(value);
  });
  return { ...fixture, chats, addTurn, loseNextReceipt() { loseReceipt = true; }, failConversationReads(value: boolean) { failReads = value; }, conflictNextTurn() { conflict = true; }, setAckDelay(ms: number) { ackDelay = ms; }, setReplyDelay(ms: number) { replyDelay = ms; }, close: async () => { timers.forEach(clearTimeout); await fixture.close(); } };
}
export async function startConversationPreview(production = false) {
  const fixture = createConversationFixture(); await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
  const address = fixture.server.address(); if (!address || typeof address === "string") throw Error("Missing fixture address");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const proxy = { "/api": `http://127.0.0.1:${address.port}` };
  if (production) {
    const server = await serveProduction({ root, preview: { host: "127.0.0.1", port: 0, proxy } });
    const web = server.httpServer.address(); if (!web || typeof web === "string") throw Error("Missing production address");
    return { fixture, url: `http://127.0.0.1:${web.port}`, close: async () => { await new Promise<void>(resolve => server.httpServer.close(() => resolve())); await fixture.close(); } };
  }
  const vite = await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy } }); await vite.listen();
  const web = vite.httpServer!.address(); if (!web || typeof web === "string") throw Error("Missing Web address");
  return { fixture, url: `http://127.0.0.1:${web.port}`, close: async () => { await vite.close(); await fixture.close(); } };
}
if (process.argv.includes("--preview")) {
  const preview = await startConversationPreview(); process.stdout.write(`CHAT HTTP fixture (simulated, no model): ${preview.url}\n`);
  const stop = async () => { await preview.close(); process.exit(0); }; process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
