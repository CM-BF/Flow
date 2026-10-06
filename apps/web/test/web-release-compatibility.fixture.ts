import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, realpath, rm } from "node:fs/promises";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Pool } from "pg";

export const BACKEND = "b1c2e39837c2208e6fc2c59a80e16797f26448b5";
export const NEW_WEB = "8d8ab520a9d43c7b9dafb22911416ee799ebf665";
export const RELEASE_ID = "8d8ab520a9d43c7b9dafb22911416ee7";
export const repository = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = join(repository, "docs/evidence/wpf-release01");
export const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const execute = promisify(execFile);
const git = async (...args: string[]) => (await execute("git", ["-C", repository, ...args], { maxBuffer: 1024 * 1024 })).stdout.trim();
const load = (root: string, path: string) => import(pathToFileURL(join(root, path)).href);
const adminUrl = process.env.FLOW_RELEASE_TEST_ADMIN ?? "postgresql://flow:flow-local-only@127.0.0.1:55432/postgres";
type Artifact = { artifactId: string; sourceHead: string; manifestDigest: string };
export type Wire = { method: string; path: string; key?: string; body?: string; status: number; response?: any; stream?: string; forwardedStream?: string; profile?: string; dropped: boolean };

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as { port: number }).port;
}
async function closeServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function unusedPort() { const server = createServer(); const port = await listen(server); await closeServer(server); return port; }
/** Correct production base for the candidate before a compatibility record exists. No release pointer is invented. */
async function startCandidatePreview(source: string, dist: string, artifact: Artifact, webPort: number, proxyPort: number) {
  const require = createRequire(join(source, "apps/web/package.json"));
  const { preview } = await import(pathToFileURL(require.resolve("vite")).href);
  const server = await preview({ root: dist, configFile: false, envDir: false, publicDir: false, logLevel: "silent", base: `/__flow_releases/${RELEASE_ID}/`, build: { outDir: dist },
    plugins: [{ name: "fixture-artifact-identity", configurePreviewServer(server: any) { server.middlewares.use((request: any, response: any, next: () => void) => {
      if (request.url !== "/__flow_preview_identity") return next();
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify(artifact));
    }); } }],
    preview: { host: "127.0.0.1", port: webPort, strictPort: true, open: false, cors: false, proxy: { "^/api(?:/|$)": { target: `http://127.0.0.1:${proxyPort}`, changeOrigin: false, ws: false } } } });
  return { close: () => closeServer(server.httpServer) };
}
export async function until<T>(read: () => Promise<T>, predicate: (value: T) => boolean, timeout = 15_000): Promise<T> {
  const end = Date.now() + timeout;
  do { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 50)); } while (Date.now() < end);
  throw Error("Owned compatibility fixture condition timed out");
}

/** Actual HTTP forwarding. A lost ACK is injected only after the real center answered successfully. */
async function startObservationProxy(centerPort: number) {
  const records: Wire[] = []; let loseTurn = false, legacy = false;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []; let bytes = 0;
    request.on("data", chunk => { bytes += chunk.length; if (bytes <= 64 * 1024) chunks.push(chunk); else request.destroy(); });
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const shouldDrop = loseTurn && request.method === "POST" && /\/conversations\/[^/]+\/turns$/.test(request.url ?? "");
      if (shouldDrop) loseTurn = false;
      const forwardedHeaders = { ...request.headers }; if (legacy) delete forwardedHeaders["x-flow-assistant-stream"];
      const upstream = httpRequest({ hostname: "127.0.0.1", port: centerPort, path: request.url, method: request.method, headers: forwardedHeaders }, incoming => {
        const capture: Buffer[] = []; let received = 0;
        const record: Wire = { method: request.method!, path: request.url!, status: incoming.statusCode!, dropped: false,
          ...(request.headers["idempotency-key"] ? { key: String(request.headers["idempotency-key"]) } : {}), ...(body ? { body } : {}),
          ...(request.headers["x-flow-assistant-stream"] ? { stream: String(request.headers["x-flow-assistant-stream"]) } : {}),
          ...(forwardedHeaders["x-flow-assistant-stream"] ? { forwardedStream: String(forwardedHeaders["x-flow-assistant-stream"]) } : {}),
          ...(request.headers["x-flow-execution-profile"] ? { profile: String(request.headers["x-flow-execution-profile"]) } : {}) };
        if (!shouldDrop) response.writeHead(incoming.statusCode!, incoming.headers);
        incoming.on("data", chunk => { received += chunk.length; if (received <= 1024 * 1024) capture.push(chunk); if (!shouldDrop) response.write(chunk); });
        incoming.on("end", () => {
          if (incoming.headers["content-type"]?.includes("application/json") && received <= 1024 * 1024) {
            try { record.response = JSON.parse(Buffer.concat(capture).toString("utf8")); } catch { /* Preserve status without inventing JSON. */ }
          }
          record.dropped = shouldDrop && incoming.statusCode! >= 200 && incoming.statusCode! < 300;
          records.push(record); if (records.length > 2000) { server.closeAllConnections(); throw Error("Fixture request budget exceeded"); }
          if (record.dropped) response.destroy(); else if (shouldDrop) { response.writeHead(incoming.statusCode!, incoming.headers); response.end(Buffer.concat(capture)); } else response.end();
        });
      });
      upstream.on("error", () => { if (!response.destroyed) { response.statusCode = 502; response.end("Fixture upstream unavailable"); } });
      response.on("close", () => upstream.destroy()); upstream.end(body);
    });
  });
  const port = await listen(server);
  return { port, records, loseNextTurn: () => { loseTurn = true; }, setLegacy: (value: boolean) => { legacy = value; }, close: () => closeServer(server) };
}

export async function startReleaseFixture() {
  assert.match(RELEASE_ID, /^[a-f0-9]{32}$/);
  for (const target of [BACKEND, NEW_WEB]) { assert.match(target, /^[a-f0-9]{40}$/); assert.equal(await git("cat-file", "-t", target), "commit"); }
  const parent = await realpath(await mkdtemp(join(tmpdir(), "flow-release01-")));
  const checkoutPaths: string[] = [], closures: Array<() => Promise<void>> = [];
  const databaseName = `flow_release_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${databaseName}`;
  const ownerId = randomUUID(), token = `release-fixture-${randomUUID()}`;
  let databaseCreated = false, closed = false;
  const cleanup: Record<string, unknown> = { parent, databaseName, startedAt: new Date().toISOString(), providerQueries: 0 };
  const close = async () => {
    if (closed) return; closed = true; const failures: string[] = [];
    for (const action of closures.reverse()) { try { await action(); } catch (error) { failures.push(error instanceof Error ? error.message : "Cleanup failed"); } }
    if (databaseCreated) {
      try {
        const own = new Pool({ connectionString: databaseUrl.href, max: 1 });
        try { assert.deepEqual((await own.query("SELECT id FROM public.release_fixture_owner")).rows, [{ id: ownerId }]); }
        finally { await own.end(); }
        // Any failure above deliberately prevents DROP. Other owned resource cleanup still proceeds.
        const admin = new Pool({ connectionString: adminUrl, max: 1 });
        try { await admin.query(`DROP DATABASE "${databaseName}"`); cleanup.databaseRemoved = (await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [databaseName])).rowCount === 0; }
        finally { await admin.end(); }
      } catch { failures.push("Owned database cleanup failed; verify its marker before manual cleanup"); }
    }
    for (const path of checkoutPaths) { try { assert.equal((await execute("git", ["-C", path, "status", "--porcelain"])).stdout.trim(), ""); await git("worktree", "remove", "--force", path); } catch { failures.push("Owned build checkout cleanup failed"); } }
    cleanup.finishedAt = new Date().toISOString(); cleanup.failures = failures; cleanup.retained = "Private verified artifacts only; no token/config persisted";
    await writeFile(join(evidence, "cleanup.json"), JSON.stringify(cleanup, null, 2) + "\n"); assert.deepEqual(failures, []);
  };
  try {
    const { prepareWebArtifact, verifyWebArtifact } = await load(repository, "tools/personal-preview/web-artifact.mjs");
    const { startStaticWeb } = await load(repository, "tools/personal-preview/static-web.mjs");
    const artifacts: Array<{ label: string; source: string; directory: string; dist: string; artifact: Artifact; manifest: unknown }> = [];
    for (const [label, target] of [["old", BACKEND], ["new", NEW_WEB]]) {
      const source = join(parent, `${label}-source`), directory = join(parent, `${label}-state`);
      await git("worktree", "add", "--detach", source, target); checkoutPaths.push(source); await mkdir(directory, { mode: 0o700 });
      console.log(`Preparing actual ${label} Web ${target}`);
      const installed = await execute("pnpm", ["install", "--frozen-lockfile", "--offline", "--ignore-scripts"], { cwd: source, timeout: 90_000, maxBuffer: 1024 * 1024 });
      await writeFile(join(evidence, `${label}-install.log`), installed.stdout + installed.stderr);
      const artifact: Artifact = await prepareWebArtifact({ directory, repository: source, target, ...(label === "new" ? { releaseId: RELEASE_ID } : {}) });
      const { dist, manifest } = await verifyWebArtifact({ directory, artifact });
      await writeFile(join(evidence, `${label}-manifest.json`), JSON.stringify(manifest, null, 2) + "\n");
      artifacts.push({ label, source, directory, dist, artifact, manifest });
    }
    const oldSource = artifacts[0]!.source;
    const admin = new Pool({ connectionString: adminUrl, max: 1 });
    try { await admin.query(`CREATE DATABASE "${databaseName}"`); databaseCreated = true; }
    finally { await admin.end(); }
    const own = new Pool({ connectionString: databaseUrl.href, max: 1 });
    try { await own.query("CREATE TABLE public.release_fixture_owner(id uuid PRIMARY KEY)"); await own.query("INSERT INTO public.release_fixture_owner VALUES($1)", [ownerId]); }
    finally { await own.end(); }
    const { createServer: createCenter } = await load(oldSource, "apps/server/src/index.ts");
    const app = await createCenter({ databaseUrl: databaseUrl.href, ownerToken: token });
    await app.listen({ host: "127.0.0.1", port: 0 }); closures.push(() => app.close());
    const centerPort = app.server.address().port, centerUrl = `http://127.0.0.1:${centerPort}`;
    const request = async (path: string, body?: unknown, auth = token, headers: Record<string, string> = {}) => {
      const result = await fetch(centerUrl + path, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) });
      assert.ok(result.ok, `Fixture HTTP ${path}: ${result.status}`); return result.json();
    };
    const runner = await request("/api/runners", { name: "RELEASE01 deterministic adapter", harnesses: ["claude"], capacity: 1 });
    const configuration = { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "release-synthetic", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: hash("[]"), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 30_000 } };
    const { profile } = await request("/api/runner/execution-profile", { configuration }, runner.token);
    const { runRunner } = await load(oldSource, "apps/runner/src/runtime.ts");
    const { guardExecutionProfile } = await load(oldSource, "apps/runner/src/execution-profiles.ts");
    const { verifyText } = await load(oldSource, "apps/runner/src/verifier.ts");
    const stop = new AbortController(); let runnerError: string | null = null;
    const adapter = { name: "claude", version: configuration.adapterVersion, async run(context: any) {
      const nativeSessionId = context.task.nativeSessionId ?? randomUUID();
      await context.emit({ type: "session", nativeSessionId, adapterVersion: configuration.adapterVersion, resources: ["RELEASE01 deterministic fixture; zero SDK/provider"] });
      await context.assertOwnership(); const content = "Release fixture reply: " + context.task.prompt;
      const sourceMessageId = randomUUID(), artifactId = randomUUID();
      await context.emit({ type: "assistant-final", messageId: hash(JSON.stringify([nativeSessionId, sourceMessageId])), nativeSessionId, source: "claude.sdk.result", sourceMessageId, content,
        settings: { requested: { model: configuration.model, permissionMode: "dontAsk", thinking: "disabled" }, effective: { model: null, permissionMode: null, tools: null, thinking: "unknown" } } });
      await context.emit({ type: "artifact", artifactId, title: "Synthetic output", version: hash(content), content, mediaType: "text/plain" });
      await context.emit(verifyText(artifactId, content, context.task.verification));
    } };
    const runnerPromise = runRunner({ baseUrl: centerUrl, token: runner.token, workingDirectory: join(parent, "runner"), signal: stop.signal, pollIntervalMs: 50, heartbeatIntervalMs: 500, adapters: [guardExecutionProfile(adapter, profile.reference, configuration)] }).catch((error: Error) => { if (!stop.signal.aborted) runnerError = error.message; });
    closures.push(async () => { stop.abort(); await runnerPromise; assert.equal(runnerError, null); });
    const previews = [];
    for (const artifact of artifacts) {
      const proxy = await startObservationProxy(centerPort); closures.push(proxy.close);
      const port = await unusedPort();
      const web = artifact.label === "new"
        ? await startCandidatePreview(artifact.source, artifact.dist, artifact.artifact, port, proxy.port)
        : await startStaticWeb({ directory: artifact.directory, artifact: artifact.artifact, repository: artifact.source, webPort: port, centerPort: proxy.port });
      closures.push(web.close);
      previews.push({ ...artifact, proxy, url: `http://127.0.0.1:${port}` });
    }
    await writeFile(join(evidence, "environment.json"), JSON.stringify({ startedAt: cleanup.startedAt, node: process.version, backend: BACKEND, sourceTree: await git("rev-parse", `${BACKEND}^{tree}`), oldWeb: BACKEND, newWeb: NEW_WEB, releaseId: RELEASE_ID, artifacts: previews.map(({ label, artifact, directory, url }) => ({ label, artifact, directory, url })), providerQueries: 0, isolation: "random marked database, generated fixture auth, in-process fixed backend and fixture runner" }, null, 2) + "\n");
    return { previews, profile, token, centerUrl, request, close };
  } catch (error) { await close(); throw error; }
}
