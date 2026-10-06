import { afterEach, expect, it } from "vitest";
import { createServer } from "node:http";
import { FlowClient } from "@flow/client";
import {
  conversationCreationSchema, conversationTurnSchema,
  type ConversationCreation, type ConversationSnapshot, type ConversationTurnAccepted, type KnowledgeCitation,
} from "@flow/contracts";
import { ConversationProjection } from "../src/conversations/projection";

const at = "2026-10-06T10:48:00Z";
const creation: ConversationCreation = { title: "Original", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "none" } };
const capabilities = { followUp: true, queue: false, steer: false, knowledgeContext: true, perTurnModel: false, perTurnThinking: false, perTurnTools: false } as const;
const citation: KnowledgeCitation = { projectId: "project-a", sourceId: "10000000-0000-4000-8000-000000000001", version: 1,
  contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes", start: 0, end: 4 } };
type Wire = { path: string; method: string; body: string; key: string | null };
type Reply = { status?: number; raw?: string; value?: unknown };
type Fault = (path: string, receipt: unknown) => Reply | Promise<Reply>;
const closers: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); });

/** Real loopback HTTP + public client. This small center fixture retains one immutable command receipt. */
async function fixture(initial: ConversationCreation = creation, existing = false) {
  let current: ConversationSnapshot = { conversation: { ...structuredClone(initial), id: "chat", revision: 0, createdAt: at, updatedAt: at },
    capabilities, nativeSession: null, lastTurn: null };
  const receipts = new Map<string, unknown>(); const requests: Wire[] = [];
  let fault: Fault | undefined;
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 64 * 1024) throw Error("Fixture request limit"); chunks.push(chunk); }
      const body = Buffer.concat(chunks).toString("utf8"), path = request.url!, method = request.method!;
      const key = typeof request.headers["idempotency-key"] === "string" ? request.headers["idempotency-key"] : null;
      requests.push({ path, method, body, key });
      if (requests.length > 100) throw Error("Fixture request count limit");
      let value: unknown;
      if (method === "POST") {
        if (!key) throw Error("Expected original command key");
        const before = current;
        const previous = receipts.get(key);
        if (previous) value = { ...structuredClone(previous), replayed: true };
        else if (path === "/api/conversations") {
          const input = conversationCreationSchema.parse(JSON.parse(body));
          current = { ...current, conversation: { ...current.conversation, ...input } };
          value = { conversation: current.conversation, capabilities, replayed: false };
        } else if (path === "/api/conversations/chat/turns") {
          const input = conversationTurnSchema.parse(JSON.parse(body));
          const number = input.expectedRevision + 1, taskId = `task-${number}`;
          const turn: ConversationTurnAccepted["turn"] = { id: `turn-${number}`, conversationId: "chat", number, createdAt: at,
            user: { role: "user", text: input.text },
            task: { id: taskId, title: "Original", harness: "claude", status: "queued", verificationStatus: "pending", createdAt: at, updatedAt: at },
            assistant: { state: "pending", reason: "execution-pending" }, effective: { model: null, tools: null, thinking: "unknown", source: null },
            telemetry: { kind: "execution", taskId, title: "Execution" },
            ...(input.knowledge?.length ? { context: { id: "context", contextDigest: "b".repeat(64), executionInputId: "input", executionInputDigest: "c".repeat(64), templateVersion: 1,
              sources: input.knowledge.map(ref => ({ citation: ref, byteLength: ref.locator.end - ref.locator.start, currentVersionAtFreeze: ref.version, isCurrentAtFreeze: true })) } } : {}) };
          current = { ...current, conversation: { ...current.conversation, revision: number }, lastTurn: turn };
          value = { conversation: current.conversation, turn, replayed: false };
        } else throw Error("Unexpected POST");
        if (!previous) receipts.set(key, structuredClone(value));
        const override = fault ? await fault(path, structuredClone(value)) : {};
        // A definite first rejection does not admit a command; a prior unknown receipt stays durable.
        if ((override.status ?? 200) >= 400 && !previous) { current = before; receipts.delete(key); }
        response.statusCode = override.status ?? 200; response.setHeader("content-type", "application/json");
        response.end(override.raw ?? JSON.stringify(override.value ?? value)); return;
      }
      if (path === "/api/conversations/chat") value = current;
      else if (path.startsWith("/api/conversations/chat/turns?")) value = { conversation: current.conversation, turns: current.lastTurn ? [current.lastTurn] : [], nextCursor: null };
      else throw Error(`Unexpected GET ${path}`);
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify(value));
    } catch { response.statusCode = 500; response.end(JSON.stringify({ error: { code: "fixture_error", message: "Fixture failed" } })); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("No fixture address");
  const projection = new ConversationProjection(new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: "public-test-owner" }), existing ? "chat" : null, 100_000);
  closers.push(async () => { projection.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return { projection, requests, setFault(value?: Fault) { fault = value; },
    finish() {
      const turn = current.lastTurn!; const task = { ...turn.task, status: "succeeded" as const, verificationStatus: "passed" as const };
      current = { ...current, lastTurn: { ...turn, task, assistant: { state: "available", role: "assistant", messageId: "reply", text: "Fresh authoritative reply", truncated: false,
        contentRef: { kind: "artifact", id: "detail", taskId: task.id, attemptId: "attempt", title: "Reply" },
        source: { kind: "adapter-final-artifact", adapterVersion: "claude-sdk-0.3.290-v1", taskId: task.id, attemptId: "attempt", artifactId: "artifact", artifactVersion: "d".repeat(64), detailId: "detail" } } } };
    } };
}

it.each(["json", "shape", "project"])("keeps an HTTP 200 invalid CREATE %s unknown and recovers the identical creation", async kind => {
  const f = await fixture(); f.setFault((_path, value) => kind === "json" ? { raw: "{invalid" } : kind === "shape" ? { value: {} }
    : { value: { ...value as object, conversation: { ...(value as { conversation: object }).conversation, projectId: "wrong" } } });
  await f.projection.send("  first\n", creation); const unknown = f.projection.getSnapshot().outbox!;
  expect(unknown).toMatchObject({ state: "unknown", conversationId: null, everUnknown: true });
  expect(f.requests.filter(r => r.method === "POST")).toHaveLength(1); expect(f.projection.getSnapshot().turns).toEqual([]);
  f.setFault(); await f.projection.retry();
  const creates = f.requests.filter(r => r.path === "/api/conversations"); expect(creates).toHaveLength(2);
  expect(creates[1]).toEqual(creates[0]); expect(creates[1]!.key).toBe(unknown.creationKey);
  expect(f.projection.getSnapshot().outbox).toBeNull(); expect(f.projection.getSnapshot().turns[0]!.user.text).toBe("  first\n");
});

it.each(["json", "shape", "text", "task", "context", "version"])("keeps HTTP 200 turn %s uncertainty with its frozen refs and original key", async kind => {
  const f = await fixture({ ...creation, projectId: "project-a" }, true); await f.projection.refresh();
  f.setFault((_path, raw) => {
    if (kind === "json") return { raw: "{invalid" }; if (kind === "shape") return { value: {} };
    const value = raw as ConversationTurnAccepted;
    if (kind === "text") value.turn.user.text += "changed";
    if (kind === "task") value.turn.telemetry.taskId = "another-task";
    if (kind === "context") value.turn.context!.sources[0]!.citation.locator.start = 1;
    if (kind === "version") Reflect.set(value.turn.context!, "templateVersion", 2);
    return { value };
  });
  const mutable = structuredClone(citation); const sending = f.projection.send("  exact\r\n🙂", undefined, [mutable]); mutable.locator.start = 1; await sending;
  const pending = f.projection.getSnapshot().outbox!; expect(pending).toMatchObject({ state: "unknown", everUnknown: true, request: { knowledge: [citation] } });
  expect(Object.isFrozen(pending.kind === "turn" && pending.request.knowledge?.[0]?.locator)).toBe(true);
  expect(f.projection.getSnapshot().turns).toEqual([]);
  f.setFault(); await f.projection.retry(); const posts = f.requests.filter(r => r.method === "POST");
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]); expect(posts[1]!.key).toBe(pending.turnKey);
  expect(f.projection.getSnapshot().outbox).toBeNull(); expect(f.projection.getSnapshot().turns[0]!.context!.sources[0]!.citation).toEqual(citation);
});

it("confirms an original HTTP replay without downgrading a newer final GET or auto-reading details", async () => {
  const f = await fixture(creation, true); await f.projection.refresh();
  f.setFault(() => ({ raw: "{lost" })); await f.projection.send("same message");
  f.finish(); await f.projection.refresh(); const before = f.projection.getSnapshot().turns[0];
  expect(before!.assistant.state).toBe("available"); f.setFault(); await f.projection.retry();
  expect(f.projection.getSnapshot().turns[0]).toBe(before); expect(f.projection.getSnapshot().outbox).toBeNull();
  const posts = f.requests.filter(r => r.method === "POST"); expect(posts[1]).toEqual(posts[0]);
  expect(f.requests.some(r => r.path.includes("detail"))).toBe(false);
});

it("does not replace a previously unknown original key after a retry receives HTTP 403", async () => {
  const f = await fixture(creation, true); await f.projection.refresh();
  f.setFault(() => ({ raw: "{unknown" })); await f.projection.send("keep identity"); const pending = f.projection.getSnapshot().outbox!;
  f.setFault(() => ({ status: 403, value: { error: { code: "forbidden", message: "Permission changed" } } })); await f.projection.retry();
  expect(f.projection.getSnapshot().outbox).toMatchObject({ state: "unknown", everUnknown: true, turnKey: pending.turnKey });
  f.projection.outbox.dismiss(pending.id); expect(f.projection.getSnapshot().outbox).not.toBeNull();
  const posts = f.requests.filter(r => r.method === "POST"); expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
});

it("keeps a first HTTP 409 definite and refreshes without sending with a new revision", async () => {
  const f = await fixture(creation, true); await f.projection.refresh();
  f.setFault(() => ({ status: 409, value: { error: { code: "revision_conflict", message: "Read again" } } })); await f.projection.send("conflict");
  expect(f.projection.getSnapshot().outbox).toMatchObject({ state: "rejected", request: { expectedRevision: 0 } });
  const count = f.requests.filter(r => r.method === "POST").length; await f.projection.retry();
  expect(f.requests.filter(r => r.method === "POST")).toHaveLength(count); expect(count).toBe(1);
  expect(f.projection.getSnapshot().snapshot?.conversation.revision).toBe(0);
});

it("does not apply a closed connection's delayed HTTP receipt to a new same-ID view", async () => {
  const old = await fixture(creation, true); await old.projection.refresh();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  old.setFault(async () => { entered(); await gate; return {}; });
  const sending = old.projection.send("Old center message"); await started;
  old.projection.dispose();
  try {
    const next = await fixture(creation, true); await next.projection.refresh();
    release(); await sending;
    expect(next.projection.getSnapshot()).toMatchObject({ turns: [], outbox: null, snapshot: { conversation: { revision: 0 } } });
    expect(next.requests.every(request => request.method === "GET")).toBe(true);
  } finally { release(); await sending; }
});
