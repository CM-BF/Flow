import { randomUUID, createHash } from "node:crypto";
import { createServer as httpServer, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { createServer as viteServer } from "vite";
import { createServer } from "../../server/src/index";
import { FlowClient } from "@flow/client";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = root + "docs/evidence/wpf-conversation-recovery/";
export interface RecoveryWire { method: string; path: string; key: string | null; body: string; status: number; cookie: boolean; bearer: boolean; csrf: boolean; fault?: string }

/** Real center/auth/HTTP/SSE and actual App. No provider, runner, existing product DB or personal port.
 * This is opt-in: source/type checking must never start its database or web servers. */
export async function startRecoveryFixture(label: string, signal: AbortSignal) {
  if (process.env.FLOW_RECOVERY_BROWSER !== "1") throw Error("This real HTTP/browser experiment requires its separate bounded resource window.");
  if (!/^[a-z0-9-]+$/.test(label)) throw Error("Invalid evidence label.");
  const adminUrl = process.env.FLOW_RECOVERY_TEST_ADMIN;
  if (!adminUrl) throw Error("Supply the approved isolated PG admin endpoint; no default or discovery.");
  const database = "flow_recovery_" + randomUUID().replaceAll("-", ""), databaseUrl = new URL(adminUrl); databaseUrl.pathname = "/" + database;
  const token = randomUUID(), wire: RecoveryWire[] = [], responses = new Set<ServerResponse>();
  const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 2000, query_timeout: 4000, statement_timeout: 4000 });
  let pool: Pool | undefined, app: Awaited<ReturnType<typeof createServer>> | undefined, vite: Awaited<ReturnType<typeof viteServer>> | undefined;
  let center = "", created = false, lost: "turn" | "queue" | "create" | undefined, wireBytes = 0;
  const lifecycle = new AbortController(), bound = AbortSignal.any([signal, lifecycle.signal]);
  const publicServer = httpServer(async (request, response) => {
    responses.add(response); response.on("close", () => responses.delete(response));
    const path = request.url ?? "/";
    if (!path.startsWith("/api/")) { if (vite) vite.middlewares(request, response); else { response.writeHead(503); response.end("Fixture starting"); } return; }
    try {
      if (!center) throw Error("Fixture center has not started.");
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 256 * 1024) throw Error("Fixture request bound exceeded."); chunks.push(chunk); }
      const method = request.method ?? "GET", body = Buffer.concat(chunks).toString("utf8"), headers = new Headers();
      // Preserve the browser's true public destination and source. Do not invent Origin for same-origin GET.
      for (const name of ["host", "origin", "sec-fetch-site", "cookie", "authorization", "x-flow-csrf", "content-type", "idempotency-key", "accept", "last-event-id", "x-flow-assistant-stream"])
        if (typeof request.headers[name] === "string") headers.set(name, request.headers[name]);
      const requestLife = new AbortController(); response.on("close", () => requestLife.abort());
      const upstream = await fetch(center + path, { method, headers, ...(method !== "GET" && method !== "HEAD" ? { body } : {}), signal: AbortSignal.any([bound, requestLife.signal]) });
      const row: RecoveryWire = { method, path, key: headers.get("idempotency-key"), body, status: upstream.status, cookie: headers.has("cookie"), bearer: headers.has("authorization"), csrf: headers.has("x-flow-csrf") };
      wireBytes += Buffer.byteLength(JSON.stringify(row)); if (wireBytes > 1024 * 1024) throw Error("Fixture wire budget exceeded."); wire.push(row);
      const kind = /\/turns$/.test(path) ? "turn" : /\/queue$/.test(path) ? "queue" : path === "/api/conversations" ? "create" : undefined;
      if (method === "POST" && upstream.ok && lost && lost === kind) { lost = undefined; row.fault = "center committed, response deliberately dropped"; await upstream.arrayBuffer(); response.destroy(); return; }
      for (const name of ["content-type", "cache-control", "set-cookie"]) { const value = upstream.headers.get(name); if (value) response.setHeader(name, value); }
      response.writeHead(upstream.status);
      if (upstream.headers.get("content-type")?.includes("text/event-stream") && upstream.body) {
        const stream = Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream); stream.on("error", () => response.destroy()); stream.pipe(response);
      } else response.end(await upstream.text());
    } catch (error) { if (response.headersSent || response.destroyed) response.destroy(); else { response.writeHead(502, { "content-type": "application/json" }); response.end(JSON.stringify({ error: { code: "fixture_transport", message: String(error) } })); } }
  });
  const close = async () => {
    const began = Date.now(), errors: string[] = [], deadline = began + 15_000;
    const attempt = async (name: string, operation: () => Promise<unknown>) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error("cleanup deadline")), Math.max(1, Math.min(4500, deadline - Date.now()))); })]); }
      catch (error) { errors.push(`${name}: ${String(error)}`); } finally { clearTimeout(timer); }
    };
    lifecycle.abort(); for (const response of responses) response.destroy(); publicServer.closeAllConnections();
    await attempt("vite", async () => { await vite?.close(); });
    await attempt("public HTTP", async () => { if (publicServer.listening) await new Promise<void>((resolve, reject) => publicServer.close(error => error ? reject(error) : resolve())); });
    await attempt("center", async () => { await app?.close(); });
    await attempt("fixture pool", async () => { await pool?.end(); });
    let connections: number | null = null, remaining: unknown = null;
    await attempt("own database", async () => {
      connections = Number((await admin.query("SELECT count(*) FROM pg_stat_activity WHERE datname=$1", [database])).rows[0].count);
      if (created && connections === 0) { await admin.query(`DROP DATABASE "${database}"`); created = false; }
      remaining = (await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [database])).rows;
      if (connections || created) throw Error("Own database not clean; no other connections were terminated.");
    });
    await attempt("admin", () => admin.end());
    await writeFile(evidence + label + "-cleanup.json", JSON.stringify({ database, connections, remaining, errors, elapsedMs: Date.now() - began, wireBytes, providerQueries: 0 }, null, 2));
    if (errors.length) throw Error("Recovery fixture cleanup incomplete; see retained raw evidence.");
  };
  try {
    await mkdir(evidence, { recursive: true }); bound.throwIfAborted();
    await new Promise<void>(resolve => publicServer.listen(0, "127.0.0.1", resolve)); const address = publicServer.address(); if (!address || typeof address === "string") throw Error("No fixture address.");
    const url = `http://127.0.0.1:${address.port}`;
    if ((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])).rowCount) throw Error("Refusing an existing database.");
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    pool = new Pool({ connectionString: databaseUrl.href, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 4000 });
    app = await createServer({ databaseUrl: databaseUrl.href, ownerToken: token, automaticQueueScan: false, browserSession: { cookieOrigin: url, trustedOrigins: [url], authEpoch: "recovery-fixture-v1" } });
    center = await app.listen({ host: "127.0.0.1", port: 0 }); bound.throwIfAborted();
    const client = new FlowClient({ baseUrl: center, token });
    const project = await client.createProject({ workspaceId: "personal", title: "Recovery project" }, randomUUID());
    const conversation = await client.createConversation({ title: "Recovery conversation", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" }, projectId: project.snapshot.project.id }, randomUUID());
    const capabilities = await client.attachmentCapabilities(project.snapshot.project.id), text = "Same material\r\n中文🙂";
    const resource = await client.uploadAttachment(project.snapshot.project.id, { recoveryScopeId: capabilities.recoveryScopeId, name: "saved.txt", mediaType: "text/plain", text, byteLength: Buffer.byteLength(text), contentDigest: createHash("sha256").update(text).digest("hex") }, randomUUID());
    vite = await viteServer({ root: root + "apps/web", configFile: root + "apps/web/vite.config.ts", cacheDir: evidence + "vite-cache", define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { middlewareMode: true, proxy: {}, hmr: { server: publicServer } }, logLevel: "error" });
    bound.throwIfAborted();
    return { url: url + "/?recovery=1", token, wire, resource: resource.resource, conversationId: conversation.conversation.id, projectId: project.snapshot.project.id, close,
      dropNext(kind: typeof lost) { lost = kind; },
      expireSessions: () => pool!.query("UPDATE flow.browser_sessions SET expires_at=clock_timestamp()-interval '1 second'"),
      revokeSessions: () => pool!.query("DELETE FROM flow.browser_sessions"),
    };
  } catch (error) { await close(); throw error; }
}
