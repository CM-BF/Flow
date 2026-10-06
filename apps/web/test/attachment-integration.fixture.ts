import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { randomUUID, createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { preview } from "vite";
import { createServer } from "../../server/src/index";
import { FlowClient } from "@flow/client";
import { conversationCreationSchema } from "@flow/contracts";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = root + "docs/evidence/wpf-attach-i02/";
export async function startAttachmentPreview(label: string, signal: AbortSignal) {
  const database = "flow_attachi02_" + randomUUID().replaceAll("-", ""), token = randomUUID();
  const admin = new Pool({ connectionString: "postgresql://flow:flow-local-only@127.0.0.1:55432/postgres", max: 1, connectionTimeoutMillis: 2000, query_timeout: 4000, statement_timeout: 4000 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined, web: Awaited<ReturnType<typeof preview>> | undefined;
  let proxy: ReturnType<typeof createHttpServer> | undefined, requested = false, corruptTurn = false, corruptQueue = false, corruptUpload = false;
  const wire: { method: string; path: string; key: string | null; body: string; status: number; response?: string; fault?: string }[] = [];
  let wireBytes = 0;
  const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), providerQueries: 0, factory: "createServer(default modules)", fallbackMount: false };
  const close = async () => {
    const errors: string[] = [];
    const cleanupDeadline = Date.now() + 18_000;
    const attempt = async <T,>(name: string, operation: () => Promise<T>): Promise<T | undefined> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("cleanup deadline")), Math.max(1, Math.min(4500, cleanupDeadline - Date.now()))); })]); }
      catch (error) { errors.push(`${name}: ${String(error)}`); return undefined; } finally { clearTimeout(timer); }
    };
    const cleanupStart = Date.now();
    await attempt("web", async () => { await web?.close(); });
    await attempt("proxy", async () => { if (proxy?.listening) { proxy.closeAllConnections(); await new Promise<void>((resolve, reject) => proxy!.close(error => error ? reject(error) : resolve())); } });
    await attempt("app", async () => { await app?.close(); });
    const rows = await attempt("database connections", () => admin.query("SELECT pid FROM pg_stat_activity WHERE datname=$1", [database]));
    if (requested && rows?.rows.length === 0) await attempt("drop own database", () => admin.query(`DROP DATABASE IF EXISTS "${database}"`));
    const remaining = await attempt("remaining database", () => admin.query("SELECT datname FROM pg_database WHERE datname=$1", [database]));
    await attempt("admin", () => admin.end());
    Object.assign(facts, { cleanupAt: new Date().toISOString(), cleanupMs: Date.now() - cleanupStart, remaining: remaining?.rows ?? null, errors, wireBytes });
    await writeFile(evidence + `${label}-cleanup.json`, JSON.stringify(facts, null, 2));
    if (errors.length || remaining?.rows.length !== 0) throw Error("Fixture cleanup incomplete; see raw cleanup evidence.");
  };
  try {
    signal.throwIfAborted(); await mkdir(evidence, { recursive: true });
    if ((await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [database])).rows.length) throw Error("Random database already exists.");
    requested = true; await admin.query(`CREATE DATABASE "${database}"`);
    app = await createServer({ databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`, ownerToken: token });
    signal.throwIfAborted();
    const center = await app.listen({ host: "127.0.0.1", port: 0 });
    signal.throwIfAborted();
    const client = new FlowClient({ baseUrl: center, token });
    const projectId = (await client.createProject({ workspaceId: "personal", title: "Attachment HTTP project" }, randomUUID())).snapshot.project.id;
    const capabilities = await client.attachmentCapabilities(projectId);
    const text = "<script>not executed</script>\nFixed text 中文🙂\r\n";
    const accepted = await client.uploadAttachment(projectId, { recoveryScopeId: capabilities.recoveryScopeId, name: "existing.txt", mediaType: "text/plain", text, byteLength: Buffer.byteLength(text), contentDigest: createHash("sha256").update(text).digest("hex") }, randomUUID());
    const legacy = await client.createConversation(conversationCreationSchema.parse({ title: "Plain legacy conversation" }), randomUUID());
    const other = await client.createConversation(conversationCreationSchema.parse({ title: "Other project chat", projectId }), randomUUID());
    proxy = createHttpServer(async (request, response) => {
      try {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 65536) throw Error("request budget"); chunks.push(chunk); }
        const body = Buffer.concat(chunks).toString("utf8"), method = request.method ?? "GET", path = request.url ?? "/";
        const headers: Record<string, string> = {};
        for (const name of ["authorization", "content-type", "idempotency-key"]) { const value = request.headers[name]; if (typeof value === "string") headers[name] = value; }
        const stream = request.headers.accept?.includes("text/event-stream") || path.includes("/stream");
        const requestLifetime = new AbortController(); response.on("close", () => requestLifetime.abort());
        const upstream = await fetch(center + path, { method, headers, ...(method !== "GET" && method !== "HEAD" ? { body } : {}), signal: AbortSignal.any([signal, requestLifetime.signal, ...(stream ? [] : [AbortSignal.timeout(12000)])]) });
        if (upstream.headers.get("content-type")?.includes("text/event-stream") && upstream.body) {
          wire.push({ method, path, key: null, body: "", status: upstream.status });
          response.writeHead(upstream.status, { "content-type": "text/event-stream", "cache-control": "no-cache" });
          const reader = upstream.body.getReader();
          const source = Readable.from((async function* () {
            try { for (;;) { const chunk = await reader.read(); if (chunk.done) return; yield chunk.value; } }
            finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          })());
          source.on("error", () => response.destroy()); source.pipe(response); return;
        }
        let result = await upstream.text(), fault: string | undefined;
        if (upstream.ok && method === "POST") {
          if (corruptTurn && /\/conversations\/[^/]+\/turns$/.test(path)) { corruptTurn = false; result = "{}"; fault = "bad accepted turn acknowledgement"; }
          if (corruptQueue && /\/conversations\/[^/]+\/queue$/.test(path)) { corruptQueue = false; result = "{}"; fault = "bad accepted queue acknowledgement"; }
          if (corruptUpload && /\/projects\/[^/]+\/attachments$/.test(path)) { corruptUpload = false; result = "{}"; fault = "bad accepted upload acknowledgement"; }
        }
        const record = { method, path, key: headers["idempotency-key"] ?? null, body, status: upstream.status,
          ...(method === "POST" || /attachments/.test(path) ? { response: result } : {}), ...(fault ? { fault } : {}) };
        wireBytes += Buffer.byteLength(JSON.stringify(record)); if (wireBytes > 4 * 1024 * 1024) throw Error("wire evidence budget"); wire.push(record);
        response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" }); response.end(result);
      } catch (error) { if (response.headersSent || response.destroyed) { response.destroy(); return; } response.writeHead(502, { "content-type": "application/json" }); response.end(JSON.stringify({ error: { code: "fixture_proxy", message: String(error) } })); }
    });
    await new Promise<void>(resolve => proxy!.listen(0, "127.0.0.1", resolve)); const address = proxy.address(); if (!address || typeof address === "string") throw Error("No proxy address");
    const proxyUrl = `http://127.0.0.1:${address.port}`, outDir = evidence + "production-artifact";
    signal.throwIfAborted();
    const require = createRequire(import.meta.url), cli = join(dirname(require.resolve("vite/package.json")), "bin/vite.js");
    await new Promise<void>((resolve, reject) => execFile(process.execPath, [cli, "build", "--outDir", outDir, "--emptyOutDir"], {
      cwd: root + "apps/web", env: { ...process.env, VITE_FLOW_FIXTURE: "false" }, signal, timeout: 60_000, maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => { void writeFile(evidence + `${label}-build.log`, stdout + stderr).then(() => error ? reject(error) : resolve(), reject); }));
    signal.throwIfAborted();
    web = await preview({ root: root + "apps/web", configFile: root + "apps/web/vite.config.ts", build: { outDir }, preview: { host: "127.0.0.1", port: 0, strictPort: false, proxy: { "/api": { target: proxyUrl, changeOrigin: true } } }, logLevel: "warn" });
    signal.throwIfAborted();
    return { url: web.resolvedUrls!.local[0]!, token, projectId, legacyId: legacy.conversation.id, otherId: other.conversation.id, resource: accepted.resource, client, wire, close,
      badTurn() { corruptTurn = true; }, badQueue() { corruptQueue = true; }, badUpload() { corruptUpload = true; } };
  } catch (error) { await close(); throw error; }
}
