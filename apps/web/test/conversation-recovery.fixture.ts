import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createServer as httpServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = root + "docs/evidence/wpf-conversation-recovery/";
type ObservedRecoveryRecord = { id: string; kind: string; phase?: string; version: number; owner: { viewKey: string; routeId: string };
  data?: { text?: string; intent?: string; attachments?: unknown[] }; frozen?: unknown };
/** Also serialized by page.evaluate: no captured imports, constants or helpers. Never creates schema. */
export function observeRecoveryRecords(options: { name: string; version: number; timeoutMs: number }, factory: IDBFactory = globalThis.indexedDB):
  Promise<{ state: "pending" | "ready"; records: ObservedRecoveryRecord[] }> {
  return new Promise((resolve, reject) => {
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 2000) { reject(Error("Invalid journal observation deadline.")); return; }
    let settled = false, missing = false, database: IDBDatabase | undefined, transaction: IDBTransaction | undefined;
    // Object methods avoid transpiler-generated outer function-name helpers in the serialized body.
    const completion = {
      close() { database?.close(); database = undefined; },
      finish(error?: Error, records: ObservedRecoveryRecord[] = []) {
        if (settled) return; settled = true; clearTimeout(timer);
        if (error) { try { transaction?.abort(); } catch { /* It may already have completed. */ } }
        completion.close();
        if (error) reject(error); else resolve({ state: missing ? "pending" : "ready", records });
      },
    };
    const timer = setTimeout(() => completion.finish(Error("Journal observation timed out.")), options.timeoutMs);
    try {
      const request = factory.open(options.name, options.version);
      request.onupgradeneeded = event => {
        database = request.result;
        try {
          if (!request.transaction) throw Error("Missing journal upgrade transaction.");
          request.transaction.abort(); missing = event.oldVersion === 0;
          completion.finish(missing ? undefined : Error("Existing test journal has an unexpected schema version."));
          // Abort even when this event arrives after a timeout or blocked error.
        } catch { completion.finish(Error("Cannot abort unexpected journal upgrade.")); }
        finally { completion.close(); }
      };
      request.onerror = event => { event.preventDefault(); completion.finish(Error("Cannot read existing test journal.")); };
      request.onblocked = () => completion.finish(Error("Journal observation is blocked."));
      request.onsuccess = () => {
        database = request.result;
        if (settled) { completion.close(); return; }
        try {
          if (!database.objectStoreNames.contains("records") || !database.objectStoreNames.contains("manifest")) throw Error("Existing test journal is malformed: required stores are missing.");
          transaction = database.transaction("records", "readonly");
          const read = transaction.objectStore("records").getAll();
          transaction.oncomplete = () => completion.finish(undefined, read.result);
          transaction.onabort = () => completion.finish(Error("Test readonly transaction aborted."));
          transaction.onerror = () => completion.finish(Error("Test readonly transaction failed."));
        } catch { completion.finish(Error("Existing test journal cannot be read: invalid schema or transaction.")); }
      };
    } catch { completion.finish(Error("Cannot open existing test journal.")); }
  });
}

export interface RecoveryWire {
  method: string; path: string; key: string | null; body: string; status: number; cookie: boolean; bearer: boolean; csrf: boolean;
  responseBody?: string; responseSha256?: string;
  fault?: { kind: "truncated-ack-body"; contentLength: number; contentType: string; prefixBytes: number; prefixSha256: string;
    headersFlushed: boolean; prefixFlushed: boolean; endFlushed: boolean; socketClosed: boolean; error?: string };
}
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type CommandKind = "turn" | "queue" | "create";

/** Buffer only a bounded command ACK, never session credentials or streaming content. */
async function readAcknowledgement(source: IncomingMessage, kind: CommandKind) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of source) {
    size += chunk.length; assert.ok(size <= 128 * 1024, "Command ACK exceeds fixture bound"); chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks), contentType = source.headers["content-type"] ?? "";
  assert.ok(source.complete && bytes.length > 1, "Complete upstream ACK required");
  assert.ok(!source.headers["content-encoding"] || source.headers["content-encoding"] === "identity", "Compressed ACK is not injectable");
  assert.match(contentType, /^application\/json(?:\s*;|$)/i);
  const length = source.headers["content-length"], transfer = source.headers["transfer-encoding"];
  assert.ok(!(length && transfer) && (!transfer || transfer.toLowerCase() === "chunked"), "Ambiguous upstream framing");
  if (length !== undefined) { assert.match(length, /^\d+$/); assert.equal(Number(length), bytes.length); }
  assert.ok(bytes.equals(Buffer.from(bytes.toString("utf8"))), "ACK must be valid UTF8");
  const ack: unknown = JSON.parse(bytes.toString("utf8"));
  assert.ok(ack && typeof ack === "object" && !Array.isArray(ack));
  const identity = (ack as Record<string, unknown>)[kind === "turn" ? "turn" : kind === "queue" ? "item" : "conversation"];
  assert.ok(identity && typeof identity === "object" && "id" in identity && typeof identity.id === "string", "Real accepted identity required");
  return { bytes, contentType };
}

/** Lose a genuine ACK suffix after its headers; a pre-header reset may be transparently retried. */
async function truncateAcknowledgement(response: ServerResponse, bytes: Buffer, contentType: string, row: RecoveryWire, signal: AbortSignal) {
  signal.throwIfAborted();
  const socket = response.socket; assert.ok(socket && !socket.destroyed);
  const prefix = bytes.subarray(0, 1);
  const fault: NonNullable<RecoveryWire["fault"]> = { kind: "truncated-ack-body", contentLength: bytes.length, contentType,
    prefixBytes: prefix.length, prefixSha256: sha(prefix), headersFlushed: false, prefixFlushed: false, endFlushed: false, socketClosed: false };
  row.fault = fault;
  await new Promise<void>((resolve, reject) => {
    const fail = (message: string) => { fault.error ??= message; socket.destroy(); };
    const onResponseError = () => fail("Downstream ACK response error");
    const onSocketError = () => fail("Downstream ACK socket error");
    const onAbort = () => fail("ACK fault aborted");
    const timeout = setTimeout(() => fail("ACK fault close deadline"), 1000);
    socket.once("close", hadError => {
      clearTimeout(timeout); signal.removeEventListener("abort", onAbort);
      response.off("error", onResponseError); socket.off("error", onSocketError); fault.socketClosed = true;
      if (hadError || fault.error || !fault.prefixFlushed || !fault.endFlushed) reject(Error(fault.error ?? "ACK fault closed before local flush"));
      else resolve();
    });
    response.once("error", onResponseError); socket.once("error", onSocketError); signal.addEventListener("abort", onAbort, { once: true });
    try {
      signal.throwIfAborted();
      response.writeHead(row.status, { "content-type": contentType, "content-length": bytes.length, "connection": "close", "cache-control": "no-store" });
      response.flushHeaders(); fault.headersFlushed = true;
      response.write(prefix, error => {
        if (error) { fail("ACK prefix write failed"); return; }
        fault.prefixFlushed = true; socket.end(() => { fault.endFlushed = true; });
      });
    } catch { fail("ACK fault setup failed"); }
  });
}

type ConnectionObservation = { phase: "before-marker" | "after-marker"; attempt: number; elapsedMs: number;
  total: number | null; sessions: { pid: number; state: string | null }[]; code?: string };

export interface RecoveryFixtureOptions {
  databaseUrl: string;
  directory: string;
  cacheDirectory: string;
  checkpoint(): Promise<void>;
}

/** Parent-owned DB lease. Attempt/confirmation/marker facts survive a killed or hung worker.
 * A lost CREATE acknowledgement is never enough authority to DROP by a random name alone. */
export class RecoveryDatabaseLease {
  readonly database = "flow_recovery_" + randomUUID().replaceAll("-", "");
  readonly marker = randomUUID();
  readonly state = { attempted: false, confirmed: false, markerWritten: false };
  private admin: Pool | undefined;
  private databasePool: Pool | undefined;
  private readonly observations: ConnectionObservation[] = [];
  constructor(private readonly adminUrl: string, private readonly directory: string) { this.record(); }
  get url() { const value = new URL(this.adminUrl); value.pathname = "/" + this.database; return value.href; }
  private record() { writeFileSync(join(this.directory, "database-owner.json"), JSON.stringify({ database: this.database, marker: this.marker, ...this.state }), { mode: 0o600 }); }
  async create(checkpoint: () => Promise<void>) {
    await checkpoint();
    const { Pool } = await import("pg");
    await checkpoint();
    const options = { max: 1, connectionTimeoutMillis: 1500, query_timeout: 2500, statement_timeout: 2000 };
    this.admin = new Pool({ connectionString: this.adminUrl, ...options });
    if ((await this.admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [this.database])).rowCount) throw Error("Refusing an existing database.");
    await checkpoint();
    this.state.attempted = true; this.record(); // Persist before the first possibly committed CREATE.
    await this.admin.query(`CREATE DATABASE "${this.database}"`);
    this.state.confirmed = true; this.record();
    await checkpoint();
    this.databasePool = new Pool({ connectionString: this.url, ...options });
    await this.databasePool.query("CREATE TABLE public.recovery_fixture_owner(id uuid PRIMARY KEY)");
    await checkpoint();
    await this.databasePool.query("INSERT INTO public.recovery_fixture_owner VALUES($1)", [this.marker]);
    this.state.markerWritten = true; this.record();
    await this.databasePool.end(); this.databasePool = undefined;
    await checkpoint();
  }
  private async observeZero(phase: ConnectionObservation["phase"], cleanupDeadline: number) {
    assert.ok(this.admin);
    const began = performance.now(), deadline = Math.min(began + 1000, cleanupDeadline);
    for (let attempt = 1; attempt <= 8; attempt++) {
      const remainingMs = Math.floor(deadline - performance.now());
      if (remainingMs <= 0) break;
      const query = { text: "SELECT pid,state,count(*) OVER()::int AS total FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 16",
        values: [this.database], query_timeout: Math.max(1, Math.min(250, remainingMs)) };
      try {
        // pg 8.23.1 honors per-query query_timeout; no concurrent/raced orphan query.
        const { rows } = await this.admin.query<{ pid: number; state: string | null; total: number }>(query);
        const total = rows[0]?.total ?? 0;
        assert.ok(Number.isSafeInteger(total) && total >= rows.length);
        assert.ok(rows.every(row => Number.isSafeInteger(row.pid) && (row.state === null || typeof row.state === "string" && row.state.length <= 64)));
        this.observations.push({ phase, attempt, elapsedMs: performance.now() - began, total, sessions: rows.map(({ pid, state }) => ({ pid, state })) });
        if (performance.now() >= deadline) break;
        if (total === 0) return 0;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : "OBSERVATION_FAILED";
        this.observations.push({ phase, attempt, elapsedMs: performance.now() - began, total: null, sessions: [], code });
        throw Error(`Owned DB connection observation failed (${code}); no DROP.`);
      }
      const delay = Math.min(50, deadline - performance.now());
      if (delay > 0) await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
    throw Error("Owned DB zero-connection observation deadline/attempt limit; no FORCE or termination.");
  }
  async close(cleanupDeadline: number) {
    const errors: string[] = [];
    let remaining: unknown[] | null = null, connections: number | null = null, removed = false;
    try { await this.databasePool?.end(); this.databasePool = undefined; } catch (error) { errors.push("marker pool: " + String(error)); }
    if (this.state.attempted && !this.state.confirmed) errors.push("CREATE acknowledgement unknown; retain exact owner facts for explicit inspection.");
    try {
      if (this.admin) {
        remaining = (await this.admin.query("SELECT datname FROM pg_database WHERE datname=$1", [this.database])).rows;
        connections = await this.observeZero("before-marker", cleanupDeadline);
        if (remaining.length && this.state.confirmed && this.state.markerWritten && connections === 0) {
          const { Pool } = await import("pg");
          const check = new Pool({ connectionString: this.url, max: 1, connectionTimeoutMillis: 1500, query_timeout: 2500, statement_timeout: 2000 });
          try {
            const rows = (await check.query("SELECT id FROM public.recovery_fixture_owner")).rows;
            if (rows.length !== 1 || rows[0].id !== this.marker) throw Error("Database ownership marker does not match; no DROP.");
          } finally { await check.end(); }
          connections = null; // The marker connection must be observed closed independently.
          connections = await this.observeZero("after-marker", cleanupDeadline);
          if (connections !== 0) throw Error("Database still has connections; no FORCE or unrelated termination.");
          await this.admin.query(`DROP DATABASE "${this.database}"`);
          remaining = (await this.admin.query("SELECT datname FROM pg_database WHERE datname=$1", [this.database])).rows;
          removed = remaining.length === 0;
        }
        if (remaining.length || connections !== 0) errors.push("Database remains or connection cleanup is incomplete; rerun blocked.");
      } else if (this.state.attempted) errors.push("No admin observer available for attempted CREATE cleanup.");
    } catch (error) { errors.push("owned database: " + String(error)); }
    try { await this.admin?.end(); } catch (error) { errors.push("admin pool: " + String(error)); }
    const result = { database: this.database, ...this.state, remaining, connections, removed, errors, observations: this.observations };
    writeFileSync(join(this.directory, "database-cleanup.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
    return result;
  }
}

/** Real center/auth/HTTP/SSE and actual App, inside the parent's owned worker group.
 * Imports and each startup await are behind the parent's admitted resource/deadline gate. */
export async function startRecoveryFixture(options: RecoveryFixtureOptions, signal: AbortSignal) {
  if (process.env.FLOW_RECOVERY_BROWSER !== "1") throw Error("Separate resource admission is required.");
  const checkpoint = async () => { signal.throwIfAborted(); await options.checkpoint(); signal.throwIfAborted(); };
  await checkpoint();
  const [{ Pool }, { createServer: viteServer }, { createServer }, { FlowClient }] = await Promise.all([
    import("pg"), import("vite"), import("../../server/src/index"), import("@flow/client"),
  ]);
  await checkpoint();
  const token = randomUUID(), wire: RecoveryWire[] = [], responses = new Set<ServerResponse>();
  const ackWrites = new Set<Promise<void>>(), ackErrors: string[] = [];
  const pool = new Pool({ connectionString: options.databaseUrl, max: 1, connectionTimeoutMillis: 2000, query_timeout: 4000, statement_timeout: 4000 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined, vite: Awaited<ReturnType<typeof viteServer>> | undefined;
  let center = "", lost: CommandKind | undefined, wireBytes = 0;
  const measureWire = () => { wireBytes = Buffer.byteLength(JSON.stringify(wire)); assert.ok(wireBytes <= 1024 * 1024, "Fixture wire budget exceeded"); };
  const lifecycle = new AbortController(), bound = AbortSignal.any([signal, lifecycle.signal]);
  const publicServer = httpServer(async (request, response) => {
    responses.add(response); response.on("close", () => responses.delete(response));
    const path = request.url ?? "/";
    if (!path.startsWith("/api/")) { if (vite) vite.middlewares(request, response); else { response.writeHead(503); response.end("Fixture starting"); } return; }
    try {
      if (!center) throw Error("Fixture center has not started.");
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 256 * 1024) throw Error("Fixture request bound exceeded."); chunks.push(chunk); }
      const method = request.method ?? "GET", bytes = Buffer.concat(chunks), body = bytes.toString("utf8"), headers: string[] = [];
      // Native HTTP keeps the public Host while connecting to the owned center port.
      // Preserve duplicate caller fields too; the center must decide whether they are valid.
      const forwarded = new Set(["host", "origin", "sec-fetch-site", "cookie", "authorization", "x-flow-csrf", "content-type", "idempotency-key", "accept", "last-event-id", "x-flow-assistant-stream"]);
      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        const name = request.rawHeaders[index], value = request.rawHeaders[index + 1];
        if (name !== undefined && value !== undefined && forwarded.has(name.toLowerCase())) headers.push(name, value);
      }
      const hasBody = method !== "GET" && method !== "HEAD";
      if (hasBody) headers.push("Content-Length", String(bytes.length));
      await new Promise<void>((resolve, reject) => {
        let upstream: IncomingMessage | undefined, settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          response.off("close", closed); response.off("finish", closed);
          upstream?.destroy(); outgoing.destroy();
          if (error) reject(error); else resolve();
        };
        const closed = () => finish(), failed = (error: Error) => finish(error);
        const outgoing = httpRequest(center + path, { method, headers, setHost: false, agent: false, signal: bound }, source => {
          source.on("error", failed); source.once("aborted", () => failed(Error("Fixture upstream response aborted.")));
          if (settled) { source.destroy(); return; }
          upstream = source;
          try {
            const status = source.statusCode;
            if (status === undefined) throw Error("Fixture upstream has no HTTP status.");
            const row: RecoveryWire = { method, path, key: typeof request.headers["idempotency-key"] === "string" ? request.headers["idempotency-key"] : null, body, status, cookie: request.headers.cookie !== undefined, bearer: request.headers.authorization !== undefined, csrf: request.headers["x-flow-csrf"] !== undefined };
            wire.push(row); measureWire();
            const kind = /\/turns$/.test(path) ? "turn" : /\/queue$/.test(path) ? "queue" : path === "/api/conversations" ? "create" : undefined;
            if (method === "POST" && status >= 200 && status < 300 && kind) {
              const inject = lost === kind; if (inject) lost = undefined;
              const operation = (async () => {
                const { bytes: ack, contentType } = await readAcknowledgement(source, kind);
                row.responseBody = ack.toString("utf8"); row.responseSha256 = sha(ack); measureWire();
                if (inject) await truncateAcknowledgement(response, ack, contentType, row, bound);
                else {
                  for (const name of ["content-type", "cache-control", "set-cookie"]) {
                    const value = source.headers[name]; if (value !== undefined) response.setHeader(name, value);
                  }
                  response.writeHead(status, { "content-length": ack.length }); response.end(ack);
                }
                measureWire();
              })().catch(error => {
                // Retain a fixture failure even if response.close already settled the proxy promise.
                if (ackErrors.length < 16) ackErrors.push(inject ? "ACK body-loss injection failed" : "Command ACK capture/forward failed");
                response.destroy(); failed(error instanceof Error ? error : Error(String(error)));
              });
              ackWrites.add(operation); void operation.then(() => ackWrites.delete(operation)); return;
            }
            // In particular, Set-Cookie is a string[]: never join separate cookie updates.
            for (const name of ["content-type", "cache-control", "set-cookie"]) {
              const value = source.headers[name]; if (value !== undefined) response.setHeader(name, value);
            }
            response.writeHead(status);
            source.pipe(response); // SSE and ordinary bodies share backpressure and browser-close cancellation.
          } catch (error) { failed(error instanceof Error ? error : Error(String(error))); }
        });
        // Keep error handlers until these destroyed streams are collected, including late abort errors.
        outgoing.on("error", failed);
        response.once("close", closed); response.once("finish", closed); response.on("error", failed);
        if (response.destroyed) { finish(); return; }
        try { outgoing.end(hasBody ? bytes : undefined); }
        catch (error) { failed(error instanceof Error ? error : Error(String(error))); }
      });
    } catch (error) { if (response.headersSent || response.destroyed) response.destroy(); else { response.writeHead(502, { "content-type": "application/json" }); response.end(JSON.stringify({ error: { code: "fixture_transport", message: String(error) } })); } }
  });
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    const began = Date.now(), errors: string[] = [];
    const save = (complete: boolean) => writeFile(join(options.directory, "fixture-cleanup.json"), JSON.stringify({ complete, errors, elapsedMs: Date.now() - began, wireBytes, providerQueries: 0 }, null, 2));
    const attempt = async (name: string, operation: () => Promise<unknown>) => {
      await save(false);
      try { await operation(); } catch (error) { errors.push(`${name}: ${String(error)}`); }
    };
    // No orphaned Promise.race: the parent hard deadline owns/terminates this complete process group.
    lifecycle.abort(); for (const response of responses) response.destroy(); publicServer.closeAllConnections();
    await attempt("vite", async () => { await vite?.close(); });
    await attempt("public HTTP", async () => { if (publicServer.listening) await new Promise<void>((resolve, reject) => publicServer.close(error => error ? reject(error) : resolve())); });
    await attempt("command ACK writes", async () => { await Promise.all(ackWrites); measureWire(); if (ackErrors.length) throw Error(ackErrors.join("; ")); });
    await attempt("center", async () => { await app?.close(); });
    await attempt("fixture pool", () => pool.end());
    await save(true);
    if (errors.length) throw Error("Fixture cleanup incomplete; see retained raw evidence.");
  })();
  try {
    await checkpoint();
    await new Promise<void>((resolve, reject) => { publicServer.once("error", reject); publicServer.listen(0, "127.0.0.1", () => { publicServer.off("error", reject); resolve(); }); });
    await checkpoint();
    const address = publicServer.address(); if (!address || typeof address === "string") throw Error("No fixture address.");
    const url = `http://127.0.0.1:${address.port}`;
    app = await createServer({ databaseUrl: options.databaseUrl, ownerToken: token, automaticQueueScan: false, browserSession: { cookieOrigin: url, trustedOrigins: [url], authEpoch: "recovery-fixture-v1" } });
    await checkpoint();
    center = await app.listen({ host: "127.0.0.1", port: 0 }); await checkpoint();
    const client = new FlowClient({ baseUrl: center, token });
    const project = await client.createProject({ workspaceId: "personal", title: "Recovery project" }, randomUUID());
    await checkpoint();
    const conversation = await client.createConversation({ title: "Recovery conversation", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" }, projectId: project.snapshot.project.id }, randomUUID());
    await checkpoint();
    const capabilities = await client.attachmentCapabilities(project.snapshot.project.id), text = "Same material\r\n中文🙂";
    await checkpoint();
    const resource = await client.uploadAttachment(project.snapshot.project.id, { recoveryScopeId: capabilities.recoveryScopeId, name: "saved.txt", mediaType: "text/plain", text, byteLength: Buffer.byteLength(text), contentDigest: createHash("sha256").update(text).digest("hex") }, randomUUID());
    await checkpoint();
    const secondText = "Second ordered material";
    const secondResource = await client.uploadAttachment(project.snapshot.project.id, { recoveryScopeId: capabilities.recoveryScopeId, name: "later.txt", mediaType: "text/plain", text: secondText, byteLength: Buffer.byteLength(secondText), contentDigest: createHash("sha256").update(secondText).digest("hex") }, randomUUID());
    await checkpoint();
    vite = await viteServer({ root: root + "apps/web", configFile: root + "apps/web/vite.config.ts", configLoader: "native", cacheDir: options.cacheDirectory, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { middlewareMode: true, proxy: {}, hmr: { server: publicServer } }, logLevel: "error" });
    await checkpoint();
    return { url: url + "/?recovery=1", token, wire, resource: resource.resource, secondResource: secondResource.resource, conversationId: conversation.conversation.id, projectId: project.snapshot.project.id, close,
      dropNext(kind: typeof lost) { lost = kind; },
      expireSessions: () => pool!.query("UPDATE flow.browser_sessions SET expires_at=clock_timestamp()-interval '1 second'"),
      revokeSessions: () => pool!.query("DELETE FROM flow.browser_sessions"),
    };
  } catch (error) { await close(); throw error; }
}
