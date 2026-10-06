import { randomUUID, createHash } from "node:crypto";
import { createServer as httpServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = root + "docs/evidence/wpf-conversation-recovery/";
export interface RecoveryWire { method: string; path: string; key: string | null; body: string; status: number; cookie: boolean; bearer: boolean; csrf: boolean; fault?: string }

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
  async close() {
    const errors: string[] = [];
    let remaining: unknown[] | null = null, connections: number | null = null, removed = false;
    try { await this.databasePool?.end(); this.databasePool = undefined; } catch (error) { errors.push("marker pool: " + String(error)); }
    if (this.state.attempted && !this.state.confirmed) errors.push("CREATE acknowledgement unknown; retain exact owner facts for explicit inspection.");
    try {
      if (this.admin) {
        remaining = (await this.admin.query("SELECT datname FROM pg_database WHERE datname=$1", [this.database])).rows;
        connections = Number((await this.admin.query("SELECT count(*) FROM pg_stat_activity WHERE datname=$1", [this.database])).rows[0].count);
        if (remaining.length && this.state.confirmed && this.state.markerWritten && connections === 0) {
          const { Pool } = await import("pg");
          const check = new Pool({ connectionString: this.url, max: 1, connectionTimeoutMillis: 1500, query_timeout: 2500, statement_timeout: 2000 });
          try {
            const rows = (await check.query("SELECT id FROM public.recovery_fixture_owner")).rows;
            if (rows.length !== 1 || rows[0].id !== this.marker) throw Error("Database ownership marker does not match; no DROP.");
          } finally { await check.end(); }
          connections = Number((await this.admin.query("SELECT count(*) FROM pg_stat_activity WHERE datname=$1", [this.database])).rows[0].count);
          if (connections !== 0) throw Error("Database still has connections; no FORCE or unrelated termination.");
          await this.admin.query(`DROP DATABASE "${this.database}"`);
          remaining = (await this.admin.query("SELECT datname FROM pg_database WHERE datname=$1", [this.database])).rows;
          removed = remaining.length === 0;
        }
        if (remaining.length || connections !== 0) errors.push("Database remains or connection cleanup is incomplete; rerun blocked.");
      } else if (this.state.attempted) errors.push("No admin observer available for attempted CREATE cleanup.");
    } catch (error) { errors.push("owned database: " + String(error)); }
    try { await this.admin?.end(); } catch (error) { errors.push("admin pool: " + String(error)); }
    const result = { database: this.database, ...this.state, remaining, connections, removed, errors };
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
  const pool = new Pool({ connectionString: options.databaseUrl, max: 1, connectionTimeoutMillis: 2000, query_timeout: 4000, statement_timeout: 4000 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined, vite: Awaited<ReturnType<typeof viteServer>> | undefined;
  let center = "", lost: "turn" | "queue" | "create" | undefined, wireBytes = 0;
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
            wireBytes += Buffer.byteLength(JSON.stringify(row)); if (wireBytes > 1024 * 1024) throw Error("Fixture wire budget exceeded."); wire.push(row);
            const kind = /\/turns$/.test(path) ? "turn" : /\/queue$/.test(path) ? "queue" : path === "/api/conversations" ? "create" : undefined;
            if (method === "POST" && status >= 200 && status < 300 && lost && lost === kind) {
              lost = undefined; row.fault = "center committed, response deliberately dropped";
              source.once("end", () => { response.destroy(); finish(); }); source.resume(); return;
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
