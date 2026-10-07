import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, request as httpRequest, type ServerResponse, type ClientRequest } from "node:http";
import type { Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { historyFixture } from "../src/conversation-context-history/fixture";
import { browserSessionReadSchema } from "../../../packages/contracts/src/browser-session";

export type HistoryCase = "zero" | "estimate" | "unknown" | "empty" | "invalid" | "error";
export interface ContextWire { ordinal: number; method: string; path: string; cookie: boolean; bearer: boolean; status: number; settled: boolean; }
export interface HistoryFixtureOptions { databaseUrl: string; directory: string; cacheDirectory: string; checkpoint(): Promise<void>; }

/** Real Cookie center + actual App. Only the two history read payloads are synthetic.
 * The real center authenticates every synthetic read; this does not prove a backend producer.
 * DB creation/drop and native groups remain owned by the existing admitted supervisor. */
export async function startContextHistoryFixture(options: HistoryFixtureOptions, signal: AbortSignal) {
  assert.equal(process.env.FLOW_CONTEXT_HISTORY_BROWSER, "1", "Separate resource admission required");
  const checkpoint = async () => { signal.throwIfAborted(); await options.checkpoint(); signal.throwIfAborted(); };
  await checkpoint();
  const [{ createServer: centerServer }, { createServer: viteServer }, { default: react }, { default: tailwind }, { FlowClient }] = await Promise.all([
    import("../../server/src/index"), import("vite"), import("@vitejs/plugin-react"), import("@tailwindcss/vite"), import("@flow/client"),
  ]);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const token = randomUUID(), wire: ContextWire[] = [], sockets = new Set<Socket>(), upstreams = new Set<ClientRequest>();
  const responses = new Set<ServerResponse>(), taskIds = new Set<string>();
  let center = "", origin = "", selection: HistoryCase = "zero", closed = false;
  let app: Awaited<ReturnType<typeof centerServer>> | undefined;
  let vite: Awaited<ReturnType<typeof viteServer>> | undefined;
  type Held = { arrived: boolean; released: boolean; settled: boolean; outcome: "armed" | "held" | "abortedWithoutDelivery" | "serverFinished"; release(): void; wait: Promise<void> };
  let hold: Held | undefined; const holds: Held[] = [];
  const append = (row: ContextWire) => {
    wire.push(row); assert.ok(wire.length <= 512 && Buffer.byteLength(JSON.stringify(wire)) <= 128 * 1024, "Bounded request evidence exceeded");
  };
  const publicServer = createServer(async (request, response) => {
    responses.add(response); response.once("close", () => responses.delete(response));
    try {
      await checkpoint();
      const url = new URL(request.url ?? "/", origin), path = url.pathname;
      if (!path.startsWith("/api/")) { assert.ok(vite); vite.middlewares(request, response); return; }
      const row: ContextWire = { ordinal: wire.length + 1, method: request.method ?? "GET", path,
        cookie: !!request.headers.cookie, bearer: !!request.headers.authorization, status: 0, settled: false };
      append(row); response.once("finish", () => { row.settled = true; });
      const history = /^\/api\/tasks\/([^/]+)\/context\/history$/.exec(path);
      const detail = /^\/api\/details\/(context-history-fixture-([^/]+))$/.exec(path);
      if (history || detail) {
        assert.equal(row.method, "GET");
        // Do not accept a fixture boolean, token cast, or an unauthenticated DTO request.
        const auth = await fetch(center + "/api/browser-session", { headers: { host: new URL(origin).host, cookie: request.headers.cookie ?? "" }, signal });
        const identity = browserSessionReadSchema.parse(await auth.json());
        if (!auth.ok || identity.state !== "ready" || !row.cookie || row.bearer) { row.status = 401; response.writeHead(401).end(); return; }
        if (history) assert.ok(taskIds.has(history[1]!));
        if (detail) assert.ok(taskIds.has(detail[2]!));
        const selected = selection, selectedHold = history && hold && !hold.arrived ? hold : undefined;
        if (selectedHold) { selectedHold.arrived = true; selectedHold.outcome = "held"; await selectedHold.wait; }
        if (response.destroyed) { if (selectedHold) { selectedHold.settled = true; selectedHold.outcome = "abortedWithoutDelivery"; } return; }
        let payload: unknown;
        if (detail) payload = { id: detail[1], kind: "detail", mediaType: "text/plain", title: "long-detail-" + "D".repeat(240), content: "Synthetic historical detail; read only on explicit request." };
        else {
          const value = historyFixture(history![1]!);
          assert.ok(value.latest);
          value.latest.detailRef.id = "context-history-fixture-" + history![1]!;
          for (const reading of [value.latest.observation.used, value.latest.observation.compactionWindow]) if (reading.kind !== "unknown" && reading.evidenceRef) reading.evidenceRef.id = value.latest.detailRef.id;
          value.latest.observation.identity.resolvedModel = "observed-" + "M".repeat(170);
          if (selected === "estimate" && value.latest.observation.used.kind !== "unknown") value.latest.observation.used.value = 2048;
          if (selected === "unknown") { value.latest.observation.used = { kind: "unknown", value: null, reason: "not-observed" }; value.latest.observation.compactionWindow = { kind: "unknown", value: null, reason: "not-observed" }; }
          if (selected === "empty") value.latest = null;
          payload = selected === "invalid" ? { ...value, current: { kind: "estimate", value: 999 } } : value;
        }
        row.status = selected === "error" ? 503 : 200;
        const body = JSON.stringify(selected === "error" ? { error: "fixture_read_unavailable" } : payload);
        assert.ok(Buffer.byteLength(body) <= 65536);
        if (selectedHold) {
          response.once("finish", () => { selectedHold.settled = true; selectedHold.outcome = "serverFinished"; });
          response.once("close", () => { if (!selectedHold.settled) { selectedHold.settled = true; selectedHold.outcome = "abortedWithoutDelivery"; } });
        }
        response.writeHead(row.status, { "content-type": "application/json", "cache-control": "no-store" }).end(body); return;
      }
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; assert.ok(bytes <= 256 * 1024); chunks.push(chunk); }
      const headers: Record<string, string | string[]> = { host: new URL(origin).host, connection: "close" };
      for (const name of ["origin", "sec-fetch-site", "cookie", "authorization", "x-flow-csrf", "content-type", "idempotency-key", "accept", "last-event-id", "x-flow-assistant-stream", "x-flow-execution-profile"]) {
        const value = request.headers[name]; if (value !== undefined) headers[name] = value;
      }
      if (row.method !== "GET" && row.method !== "HEAD") headers["content-length"] = String(bytes);
      const upstream = httpRequest(center + path + url.search, { method: row.method, headers, agent: false, signal }, incoming => {
        row.status = incoming.statusCode ?? 502;
        response.writeHead(row.status, incoming.headers); incoming.pipe(response);
        incoming.once("error", () => response.destroy());
      });
      upstreams.add(upstream); upstream.once("close", () => upstreams.delete(upstream));
      upstream.once("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
      response.once("close", () => upstream.destroy()); upstream.end(Buffer.concat(chunks));
    } catch { if (!response.headersSent) response.writeHead(500); response.end(); }
  });
  publicServer.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  let closePromise: Promise<void> | undefined;
  const close = () => closePromise ??= (async () => {
    closed = true; hold?.release(); const errors: string[] = [];
    const closing = [...responses, ...upstreams, ...sockets].map(item => new Promise<void>(resolve => { item.once("close", resolve); item.destroy(); }));
    for (const [name, action] of [
      ["vite", async () => { await vite?.close(); }],
      ["public-http", () => new Promise<void>((resolve, reject) => { if (!publicServer.listening) resolve(); else publicServer.close(error => error ? reject(error) : resolve()); })],
      ["center", async () => { await app?.close(); }],
    ] as const) { try { await action(); } catch { errors.push(name); } }
    await Promise.all(closing);
    if (responses.size || upstreams.size || sockets.size || publicServer.listening) errors.push("pending-owned-http");
    await writeFile(join(options.directory, "context-fixture-cleanup.json"), JSON.stringify({ complete: errors.length === 0, errors, pendingResponses: responses.size, pendingUpstreams: upstreams.size, sockets: sockets.size, publicListening: publicServer.listening }, null, 2) + "\n", { mode: 0o600 });
    if (errors.length) throw Error("Owned context fixture cleanup incomplete");
  })();
  try {
    await new Promise<void>((resolve, reject) => { publicServer.once("error", reject); publicServer.listen(0, "127.0.0.1", () => { publicServer.off("error", reject); resolve(); }); });
    const address = publicServer.address(); assert.ok(address && typeof address !== "string"); origin = `http://127.0.0.1:${address.port}`;
    await checkpoint();
    app = await centerServer({ databaseUrl: options.databaseUrl, ownerToken: token, automaticQueueScan: false,
      browserSession: { cookieOrigin: origin, trustedOrigins: [origin], authEpoch: "context-history-fixture-v1" } });
    center = await app.listen({ host: "127.0.0.1", port: 0 }); await checkpoint();
    const client = new FlowClient({ baseUrl: center, token });
    const makeConversation = (title: string) => client.createConversation({ title, harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" } }, randomUUID(), signal);
    const empty = await makeConversation("Context without execution"), first = await makeConversation("Context A"), second = await makeConversation("Context B");
    const seed = async (conversation: typeof first) => {
      const accepted = await client.submitConversationTurn(conversation.conversation.id, { expectedRevision: conversation.conversation.revision, text: "Synthetic context observation target", mode: "follow-up" }, randomUUID(), signal);
      taskIds.add(accepted.turn.task.id); return { conversationId: conversation.conversation.id, taskId: accepted.turn.task.id };
    };
    const a = await seed(first), b = await seed(second); await checkpoint();
    vite = await viteServer({ root: join(root, "apps/web"), configFile: false, envDir: false, cacheDir: options.cacheDirectory,
      plugins: [react(), tailwind()], define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") },
      server: { middlewareMode: true, proxy: {}, hmr: { server: publicServer } }, logLevel: "error" });
    return { url: origin + "/?recovery=1", token, a, b, emptyConversationId: empty.conversation.id, wire, close,
      select(value: HistoryCase) { assert.ok(!closed); selection = value; },
      heldReads: () => holds.map(({ arrived, released, settled, outcome }) => ({ arrived, released, settled, outcome })),
      holdNext() {
        assert.ok(!closed && (!hold || hold.settled)); let release!: () => void;
        const wait = new Promise<void>(resolve => { release = resolve; });
        hold = { arrived: false, released: false, settled: false, outcome: "armed", wait, release() { this.released = true; release(); } }; holds.push(hold);
        return hold;
      },
    };
  } catch (error) { await close(); throw error; }
}
