import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, writeFile, readdir } from "node:fs/promises";
import { createServer, request as httpRequest, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { Socket } from "node:net";
import type { ExecutionProfileConfiguration, RunnerEvent, VerificationRule } from "../../../packages/contracts/src/index.js";
import type { FlowClient } from "../../../packages/client/src/index.js";

export const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export type FilePin = { path: string; bytes: number; sha256: string };
export type Artifact = { artifactId: string; sourceHead: string; manifestDigest: string };
type Identity = { dev: number; ino: number };
export type AppInput = { label: string; artifact: Artifact; artifactRoot: string; rootIdentity: Identity; distIdentity: Identity;
  format: 1 | 2; releaseId: string | null; manifest: FilePin };
const RECOVERY_WEB_ARTIFACT: Artifact = {
  artifactId: "779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4",
  sourceHead: "c2311b6bd44a2a8e73e3b066be5f12bc8b153b37",
  manifestDigest: "779acd5b8177dac2331f2552334e10d05032a7e9ce23550016ad2bfbabdb2df4",
};
const RECOVERY_BACKEND_ARTIFACT: Artifact & { policy: "flow.backend-artifact.v1" } = {
  policy: "flow.backend-artifact.v1",
  artifactId: "b69296ade85aa19a767a28ab53a25ddd7e37841538f0120b346bc8f03f45810d",
  sourceHead: "f37a3612068c7215994750574a7451ede841bcce",
  manifestDigest: "b69296ade85aa19a767a28ab53a25ddd7e37841538f0120b346bc8f03f45810d",
};
export type RecoveryAdmission = Admission & { recoveryApp: AppInput };
export type PublicContext = { format: 1; publicOrigin: string; policySha256: string };
export type Admission = {
  finalBackend: { directory: string; root: string; artifact: Artifact & { policy: "flow.backend-artifact.v1" }; sourceTree: string; node: string; pins: FilePin[] };
  context: PublicContext;
  browserSettings: { cookieOrigin: string; trustedOrigins: string[]; authEpoch: string };
  apps: AppInput[];
  output: string;
};
/** The already reviewed external caller owns resource/time monitoring and native Chrome/process cleanup. */
export type Lifetime = { signal: AbortSignal; checkpoint: () => Promise<void> };
type DiagnosticPhase = { phase: string; step: string | null };
/** Passive, bounded metadata only. The existing Fastify error handler keeps full ownership of the socket. */
function observeClientErrors(server: Server, readPhase: () => DiagnosticPhase) {
  const originalHandlers = server.listeners("clientError");
  assert.ok(originalHandlers.length > 0, "Keep the real server clientError handler");
  const started = performance.now(), capBytes = 32 * 1024;
  type Connection = { connectionId: number; clientPort: number | null; serverPort: number | null };
  const connections = new WeakMap<Socket, Connection>();
  const errors: Array<DiagnosticPhase & Connection & { code: string; bytesParsed: number | null; elapsedMs: number }> = [];
  const upstreams: Array<DiagnosticPhase & { wireIndex: number; clientPort: number | null; serverPort: number | null; elapsedMs: number }> = [];
  let connectionId = 0, dropped = 0, invalidPhase = false;
  const phase = () => {
    const value = readPhase();
    if (!/^[a-z-]{1,48}$/.test(value.phase) || value.step !== null && !/^[a-z-]{1,48}$/.test(value.step)) {
      invalidPhase = true; return { phase: "unknown", step: null };
    }
    return { phase: value.phase, step: value.step };
  };
  const port = (value: number | undefined) => Number.isSafeInteger(value) && value! > 0 && value! <= 65535 ? value! : null;
  const elapsedMs = () => Math.round(performance.now() - started);
  const connected = (socket: Socket) => connections.set(socket, { connectionId: ++connectionId,
    clientPort: port(socket.remotePort), serverPort: port(socket.localPort) });
  const clientError = (error: Error & { code?: unknown; bytesParsed?: unknown }, socket: Socket) => {
    if (errors.length >= 16) { dropped++; return; }
    errors.push({ ...phase(), ...(connections.get(socket) ?? { connectionId: 0, clientPort: null, serverPort: null }),
      code: typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "UNKNOWN",
      bytesParsed: typeof error.bytesParsed === "number" && Number.isSafeInteger(error.bytesParsed) && error.bytesParsed >= 0 ? error.bytesParsed : null,
      elapsedMs: elapsedMs() });
  };
  server.on("connection", connected); server.on("clientError", clientError);
  return {
    upstream(socket: Socket, wireIndex: number) {
      const capture = () => {
        if (upstreams.length >= 128) { dropped++; return; }
        upstreams.push({ ...phase(), wireIndex, clientPort: port(socket.localPort), serverPort: port(socket.remotePort), elapsedMs: elapsedMs() });
      };
      if (socket.connecting) socket.once("connect", capture); else capture();
    },
    finish() {
      server.removeListener("connection", connected); server.removeListener("clientError", clientError);
      const originalHandlersPreserved = originalHandlers.every(handler => server.listeners("clientError").includes(handler));
      const rows = errors.map(error => {
        const matching = upstreams.filter(row => error.clientPort !== null && error.serverPort !== null
          && row.clientPort === error.clientPort && row.serverPort === error.serverPort);
        return { ...error, association: matching.length === 1 ? "OWNED_PROXY" : "UNKNOWN", wireIndex: matching.length === 1 ? matching[0]!.wireIndex : null };
      });
      const result = { diagnosticOnly: true, complete: dropped === 0 && !invalidPhase && originalHandlersPreserved,
        limits: { errors: 16, upstreams: 128, bytes: capBytes }, dropped, invalidPhase, originalHandlersPreserved, errors: rows, upstreams };
      if (Buffer.byteLength(JSON.stringify(result, null, 2) + "\n") > capBytes) return { ...result, complete: false, errors: [], upstreams: [], byteCapExceeded: true };
      return result;
    },
  };
}
type AssetFile = { path: string; bytes: number; sha256: string };
export type LoadedApp = AppInput & { files: AssetFile[]; snapshot: { index: AssetFile; assets: Map<string, AssetFile> } };
export function assertRecoveryAdmission(input: RecoveryAdmission) {
  assert.ok(input.recoveryApp && input.finalBackend, "New Web and corrected backend descriptors required; no 6c/7d1 fallback");
  assert.deepEqual(input.finalBackend.artifact, RECOVERY_BACKEND_ARTIFACT);
  assert.deepEqual(input.recoveryApp.artifact, RECOVERY_WEB_ARTIFACT);
  assert.match(input.recoveryApp.artifact.artifactId, /^[a-f0-9]{64}$/);
  assert.equal(input.recoveryApp.artifact.manifestDigest, input.recoveryApp.artifact.artifactId);
  assert.equal(input.recoveryApp.format, 2); assert.match(input.recoveryApp.releaseId ?? "", /^[a-f0-9]{32}$/);
  assert.ok(!retained.some(value => value[0] === input.recoveryApp.artifact.artifactId));
}
type Center = { listen(options: { host: string; port: number }): Promise<unknown>; close(): Promise<void>; server: Server };
type PoolLike = { query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; end(): Promise<void> };
type Runtime = {
  createCenter(options: { databaseUrl: string; ownerToken: string; browserSession: Admission["browserSettings"]; leaseMs: number }): Promise<Center>;
  Client: typeof FlowClient;
  Pool: new (options: { connectionString: string; max: number; connectionTimeoutMillis: number; statement_timeout: number }) => PoolLike;
  adapterVersion: ExecutionProfileConfiguration["adapterVersion"];
  parseEvent(value: unknown): RunnerEvent;
  verifyText(artifactId: string, content: string, requested?: VerificationRule): unknown;
  releaseAsset(snapshot: LoadedApp["snapshot"], rawPath: string, acceptsHtml?: boolean): Promise<{ bytes: Buffer; path: string } | null>;
  importWebCompatibility(options: { directory: string; reportDirectory: string }): Promise<string>;
  verifyWebCompatibility(options: { directory: string; artifact: Artifact; backendHead: string; compatibilityId: string; expectedContext: PublicContext }): Promise<unknown>;
};
const requiredRuntimePaths = ["tools/personal-preview/backend-release/index.mjs", "tools/personal-preview/browser-session-configuration.mjs",
  "tools/personal-preview/web-release.mjs", "apps/server/src/index.ts", "packages/client/src/index.ts", "packages/contracts/src/index.ts", "apps/server/node_modules/pg/lib/index.js", "apps/runner/src/verifier.ts"];
const retained = [
  ["461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90", "b1c2e39837c2208e6fc2c59a80e16797f26448b5", null],
  ["caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe", "8d8ab520a9d43c7b9dafb22911416ee799ebf665", "8d8ab520a9d43c7b9dafb22911416ee7"],
  ["d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88", "5069586a9f17332de526e101eca3a4250cbc8d91", "388371a4972c469b8ace623454594132"],
] as const;
export function errorCode(error: unknown): string {
  // Do not persist driver messages/URLs or credentials in failure evidence.
  return error instanceof Error ? `${error.name}:${"code" in error ? String(error.code) : "OPERATION_FAILED"}` : "UNKNOWN_FAILURE";
}
export async function pinnedBytes(pin: FilePin, limit = 32 * 1024 * 1024): Promise<Buffer> {
  assert.ok(isAbsolute(pin.path) && pin.bytes >= 0 && pin.bytes <= limit && /^[a-f0-9]{64}$/.test(pin.sha256), "Invalid file pin");
  assert.equal(await realpath(pin.path), pin.path, "Pin must name the exact regular realpath");
  const file = await open(pin.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat({ bigint: true });
    assert.ok(before.isFile() && before.nlink === 1n && before.uid === BigInt(process.getuid!()) && before.size === BigInt(pin.bytes));
    const bytes = Buffer.alloc(pin.bytes + 1); let bytesRead = 0;
    while (bytesRead < bytes.length) { const part = await file.read(bytes, bytesRead, bytes.length - bytesRead, bytesRead); if (!part.bytesRead) break; bytesRead += part.bytesRead; }
    const after = await file.stat({ bigint: true }), current = await lstat(pin.path, { bigint: true });
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs"] as const) { assert.equal(before[key], after[key]); assert.equal(after[key], current[key]); }
    assert.equal(bytesRead, pin.bytes); const result = bytes.subarray(0, bytesRead); assert.equal(hash(result), pin.sha256); return result;
  } finally { await file.close(); }
}
async function directory(path: string, identity?: Identity) {
  assert.ok(isAbsolute(path)); assert.equal(await realpath(path), path); const info = await lstat(path);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid!());
  if (identity) { assert.equal(info.dev, identity.dev); assert.equal(info.ino, identity.ino); }
  return info;
}
export async function saveJson(output: string, name: string, value: unknown) {
  assert.match(name, /^[a-z0-9][a-z0-9.-]*\.json$/); const text = JSON.stringify(value, null, 2) + "\n";
  assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024, "Raw file cap");
  await writeFile(join(output, name), text, { flag: "wx", mode: 0o600 });
}
async function runtime(input: Admission, life: Lifetime): Promise<Runtime> {
  assert.ok(input.finalBackend, "Final reviewed backend tuple is required; no legacy fallback");
  const backend = input.finalBackend; await directory(backend.root);
  assert.match(backend.artifact.sourceHead, /^[a-f0-9]{40}$/); assert.match(backend.sourceTree, /^[a-f0-9]{40}$/);
  const load = (path: string) => import(pathToFileURL(join(backend.root, path)).href);
  const pinByPath = new Map(backend.pins.map(pin => [pin.path, pin])); assert.equal(pinByPath.size, backend.pins.length);
  for (const pin of backend.pins) { assert.ok(pin.path.startsWith(backend.root + "/") && relative(backend.root, pin.path).split("/")[0] !== ".."); await pinnedBytes(pin); await life.checkpoint(); }
  for (const path of requiredRuntimePaths) {
    // Dependency entry may be an internal package symlink; only its admitted regular target is imported.
    const resolved = await realpath(join(backend.root, path)); assert.ok(resolved.startsWith(backend.root + "/")); assert.ok(pinByPath.has(resolved), `Missing fixed runtime input: ${path}`);
  }
  await life.checkpoint(); const verifier = await load(requiredRuntimePaths[0]!); await life.checkpoint();
  const verified = await verifier.verifyBackendArtifact({ directory: backend.directory, artifact: backend.artifact }); await life.checkpoint();
  assert.equal(verified.root, backend.root); assert.equal(verified.node, backend.node); assert.equal(await realpath(process.execPath), backend.node);
  assert.equal(verified.manifest.sourceTree, backend.sourceTree);
  const policy = await load(requiredRuntimePaths[1]!); await life.checkpoint();
  const settings = policy.normalizeBrowserSessionSettings(input.browserSettings);
  assert.equal(settings.cookieOrigin, "http://127.0.0.1:61228");
  assert.deepEqual(policy.browserCompatibilityContext(settings), input.context);
  assert.equal(input.context.policySha256, "81a8abe98d6541c34d07b15611e773f9bd4b53f8c6785bbaaab6e3dd03b3d638");
  const tools = await load(requiredRuntimePaths[2]!); await life.checkpoint();
  const factory = await load(requiredRuntimePaths[3]!); await life.checkpoint();
  const client = await load(requiredRuntimePaths[4]!); await life.checkpoint();
  const contracts = await load(requiredRuntimePaths[5]!); await life.checkpoint();
  const pg = await import(pathToFileURL(await realpath(join(backend.root, requiredRuntimePaths[6]!))).href); await life.checkpoint();
  assert.equal(typeof factory.createServer, "function"); assert.equal(typeof client.FlowClient, "function"); assert.equal(typeof contracts.CLAUDE_CONTEXT_SOURCE.adapterVersion, "string");
  const textVerifier = await load(requiredRuntimePaths[7]!); await life.checkpoint();
  return { createCenter: factory.createServer, Client: client.FlowClient, Pool: pg.Pool ?? pg.default.Pool,
    parseEvent: value => contracts.runnerEventSchema.parse(value), verifyText: textVerifier.verifyText,
    adapterVersion: contracts.CLAUDE_CONTEXT_SOURCE.adapterVersion, releaseAsset: tools.releaseAsset,
    importWebCompatibility: tools.importWebCompatibility, verifyWebCompatibility: tools.verifyWebCompatibility };
}
async function loadApps(inputs: AppInput[], life: Lifetime, recoveryApp?: AppInput): Promise<LoadedApp[]> {
  assert.equal(inputs.length, retained.length); assert.equal(new Set(inputs.map(app => app.label)).size, inputs.length);
  const admitted = recoveryApp ? [...inputs, recoveryApp] : inputs;
  assert.equal(new Set(admitted.map(app => app.label)).size, admitted.length);
  const loaded: LoadedApp[] = []; let totalBytes = 0;
  for (let i = 0; i < admitted.length; i++) {
    const app = admitted[i]!, expected = retained[i]; assert.match(app.label, /^[a-z0-9-]{1,32}$/);
    if (expected) {
      assert.deepEqual(app.artifact, { artifactId: expected[0], sourceHead: expected[1], manifestDigest: expected[0] });
      assert.equal(app.releaseId, expected[2]); assert.equal(app.format, expected[2] === null ? 1 : 2);
    } else {
      assert.equal(app, recoveryApp); assert.deepEqual(app.artifact, RECOVERY_WEB_ARTIFACT);
      assert.equal(app.format, 2); assert.match(app.releaseId ?? "", /^[a-f0-9]{32}$/);
      assert.ok(!inputs.some(value => value.releaseId === app.releaseId), "New namespace must be distinct");
    }
    await directory(app.artifactRoot, app.rootIdentity); const dist = join(app.artifactRoot, "dist"); await directory(dist, app.distIdentity);
    assert.equal(app.manifest.path, join(app.artifactRoot, "manifest.json")); assert.equal(app.manifest.sha256, app.artifact.manifestDigest);
    const manifest = JSON.parse((await pinnedBytes(app.manifest, 64 * 1024)).toString("utf8"));
    assert.equal(manifest.sourceHead, app.artifact.sourceHead); assert.equal(manifest.format, app.format);
    assert.equal(manifest.releaseId ?? null, app.releaseId);
    assert.equal(manifest.policy, app.format === 2 ? "flow-static-web-v2" : "flow-static-web-v1");
    assert.ok(Array.isArray(manifest.files));
    if (expected) assert.equal(manifest.files.length, 10);
    else assert.ok(manifest.files.length > 0 && manifest.files.length <= 128, "New App manifest file bound");
    assert.equal(manifest.totalBytes, manifest.files.reduce((sum: number, file: AssetFile) => sum + file.bytes, 0));
    totalBytes += manifest.totalBytes; assert.ok(Number.isSafeInteger(totalBytes) && totalBytes <= 192 * 1024 * 1024);
    const files: AssetFile[] = manifest.files;
    const assets = new Map<string, AssetFile>(); let index: AssetFile | undefined;
    for (const file of files) {
      assert.ok(typeof file.path === "string" && !file.path.startsWith("/") && file.path.split("/").every(part => part && part !== "." && part !== ".." && !part.includes("\\")));
      const path = join(dist, file.path); await pinnedBytes({ ...file, path }, 8 * 1024 * 1024); await life.checkpoint();
      const item = { ...file, path }; if (file.path === "index.html") index = item;
      const url = `${app.releaseId ? `/__flow_releases/${app.releaseId}` : ""}/${file.path}`;
      assert.ok(!assets.has(url)); assets.set(url, item);
    }
    assert.ok(index); loaded.push({ ...app, files, snapshot: { index, assets } });
  }
  return loaded;
}
export type Wire = { method: string; path: string; status: number; key?: string; body?: string; response?: Record<string, any>;
  forwardedStream?: string; profile?: string; bearer: boolean; cookie: boolean; csrf: boolean;
  logoutHold?: { received: boolean; released: boolean; downstreamFinished: boolean; setCookie: boolean }; receivedBytes: number; complete: boolean; responseSha256?: string;
  sse?: { chunks: number; bytes: number; firstChunkAt: string | null; endedAt: string | null; closedAt: string | null };
  fault?: { contentLength: number; prefixBytes: number; prefixSha256: string; headersFlushed: boolean; prefixFlushed: boolean; endFlushed: boolean; socketClosed: boolean; error?: string } };
const hopHeaders = ["connection", "keep-alive", "proxy-connection", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"];
function forwardHeaders(headers: IncomingMessage["headers"]) {
  const result = { ...headers };
  for (const key of [...hopHeaders, ...String(headers.connection ?? "").split(",").map(value => value.trim().toLowerCase())]) delete result[key];
  return result;
}
async function truncateAck(incoming: IncomingMessage, response: ServerResponse, bytes: Buffer, record: Wire) {
  assert.ok(incoming.complete && bytes.length > 1 && bytes.length <= 128 * 1024);
  assert.ok(!incoming.headers["content-encoding"] || incoming.headers["content-encoding"] === "identity");
  const contentType = incoming.headers["content-type"] ?? ""; assert.match(contentType, /^application\/json(?:\s*;|$)/i);
  const length = incoming.headers["content-length"], transfer = incoming.headers["transfer-encoding"];
  assert.ok(!(length && transfer) && (!transfer || transfer.toLowerCase() === "chunked"));
  if (length !== undefined) { assert.match(length, /^\d+$/); assert.equal(Number(length), bytes.length); }
  assert.ok(bytes.equals(Buffer.from(bytes.toString("utf8"))));
  const ack = JSON.parse(bytes.toString("utf8")); assert.equal(typeof ack.turn?.id, "string"); assert.equal(typeof ack.turn?.task?.id, "string");
  const socket = response.socket; assert.ok(socket && !socket.destroyed); const prefix = bytes.subarray(0, 1);
  const fault = { contentLength: bytes.length, prefixBytes: 1, prefixSha256: hash(prefix), headersFlushed: false, prefixFlushed: false, endFlushed: false, socketClosed: false, error: undefined as string | undefined }; record.fault = fault;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { fault.error = "ACK_CLOSE_DEADLINE"; socket.destroy(); }, 1000);
    socket.once("error", () => { fault.error = "ACK_SOCKET_ERROR"; }); response.once("error", () => { fault.error = "ACK_RESPONSE_ERROR"; socket.destroy(); });
    socket.once("close", hadError => { clearTimeout(timeout); fault.socketClosed = true;
      if (hadError || fault.error || !fault.prefixFlushed || !fault.endFlushed) reject(Error(fault.error ?? "ACK_FLUSH_UNKNOWN")); else resolve(); });
    response.writeHead(record.status, { ...forwardHeaders(incoming.headers), "content-type": contentType, "content-length": bytes.length, connection: "close", "cache-control": "no-store" });
    response.flushHeaders(); fault.headersFlushed = true;
    response.write(prefix, error => { if (error) { fault.error = "ACK_PREFIX_WRITE"; socket.destroy(); return; } fault.prefixFlushed = true; socket.end(() => { fault.endFlushed = true; }); });
  });
}
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
  const address = server.address(); assert.ok(address && typeof address !== "string" && address.port !== 61228, "Owned listener must not be public origin"); return address.port;
}
async function closeServer(server: Server, sockets: Set<Socket>) {
  const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  for (const socket of sockets) socket.destroy(); server.closeAllConnections(); await closed;
}
async function proxy(centerPort: number, publicOrigin: string, tools: Runtime, life: Lifetime, diagnostic?: ReturnType<typeof observeClientErrors>) {
  assert.ok(Number.isSafeInteger(centerPort) && centerPort > 0 && centerPort <= 65535); assert.notEqual(centerPort, 61228); let app: LoadedApp | undefined, legacy = false, faultArmed = false, publicEnabled = false;
  const records: Wire[] = [], errors: string[] = [], rejected: string[] = [], sockets = new Set<Socket>(), upstreams = new Set<ReturnType<typeof httpRequest>>();
  const pending = new Set<Promise<void>>(); let captured = 0, port = 0, closing = false;
  let logoutArmed = false, releaseHeldLogout: (() => void) | undefined;
  const canaryPath = `/__flow_proxy_canary_${randomUUID()}`; let canaryObserved = false;
  const track = (operation: Promise<void>) => { pending.add(operation); void operation.catch(error => { errors.push(errorCode(error)); }).finally(() => pending.delete(operation)); };
  const server = createServer((request, response) => {
    track((async () => {
      await life.checkpoint(); if (closing) { response.destroy(); return; } const raw = request.url ?? "";
      const hosts = request.rawHeaders.filter((_, i, all) => i % 2 === 0 && all[i]!.toLowerCase() === "host");
      assert.equal(hosts.length, 1, "Exactly one Host required");
      if (raw === `http://127.0.0.1:${port}${canaryPath}` && request.headers.host === `127.0.0.1:${port}` && request.method === "GET") {
        canaryObserved = true; publicEnabled = true; response.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" }); response.end("OWNED_PROXY_ROUTE"); return;
      }
      let url: URL;
      try { url = new URL(raw); } catch { response.writeHead(421); response.end(); if (rejected.length < 32) rejected.push("non-absolute-target"); return; }
      if (!publicEnabled || url.origin !== publicOrigin || url.username || url.password || url.hash || raw !== url.href || request.headers.host !== url.host) {
        if (rejected.length < 32) rejected.push("non-admitted-authority"); response.writeHead(421); response.end(); return;
      }
      const path = url.pathname + url.search;
      if (path === "/favicon.ico" && request.method === "GET") { response.writeHead(404); response.end(); return; }
      if (path === "/__flow_compat_probe" && request.method === "GET") { response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); response.end("<!doctype html><title>Owned compatibility probe</title>"); return; }
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        assert.ok(["GET", "POST", "OPTIONS", "DELETE", "PATCH", "PUT"].includes(request.method ?? "")); assert.ok(records.length < 1000);
        const chunks: Buffer[] = []; let count = 0;
        for await (const chunk of request) { count += chunk.length; assert.ok(count <= 64 * 1024); chunks.push(Buffer.from(chunk)); }
        if (closing) { response.destroy(); return; }
        const body = Buffer.concat(chunks); const isSession = url.pathname.startsWith("/api/browser-session");
        const selected = faultArmed && request.method === "POST" && /^\/api\/conversations\/[^/]+\/turns$/.test(url.pathname);
        if (selected) faultArmed = false;
        const heldLogout = logoutArmed && request.method === "POST" && url.pathname === "/api/browser-session/logout";
        if (heldLogout) logoutArmed = false;
        const headers = forwardHeaders(request.headers); if (legacy) delete headers["x-flow-assistant-stream"];
        // Preserve public Host/Origin/Cookie/CSRF; upstream destination is always this owned listener.
        headers.host = url.host; headers.connection = "close";
        const record: Wire = { method: request.method!, path, status: 0, bearer: String(headers.authorization ?? "").startsWith("Bearer "),
          cookie: typeof headers.cookie === "string", csrf: typeof headers["x-flow-csrf"] === "string",
          receivedBytes: 0, complete: false, ...(request.headers["idempotency-key"] ? { key: String(request.headers["idempotency-key"]) } : {}),
          ...(!isSession && body.length ? { body: body.toString("utf8") } : {}),
          ...(headers["x-flow-assistant-stream"] ? { forwardedStream: String(headers["x-flow-assistant-stream"]) } : {}),
          ...(headers["x-flow-execution-profile"] ? { profile: String(headers["x-flow-execution-profile"]) } : {}) };
        const wireIndex = records.length; records.push(record);
        await new Promise<void>((resolve, reject) => {
          let downstreamClosed = false;
          const upstream = httpRequest({ hostname: "127.0.0.1", port: centerPort, path, method: request.method, headers, agent: false }, incoming => {
            record.status = incoming.statusCode!; const sse = /text\/event-stream/i.test(String(incoming.headers["content-type"]));
            if (sse) record.sse = { chunks: 0, bytes: 0, firstChunkAt: null, endedAt: null, closedAt: null };
            if (!selected && !heldLogout) response.writeHead(record.status, forwardHeaders(incoming.headers));
            const capture: Buffer[] = []; const digest = createHash("sha256"); let captureBytes = 0;
            incoming.on("data", (chunk: Buffer) => {
              record.receivedBytes += chunk.length; digest.update(chunk);
              if (record.sse) { record.sse.chunks++; record.sse.bytes += chunk.length; record.sse.firstChunkAt ??= new Date().toISOString(); }
              if (!sse && (!isSession || heldLogout)) { captureBytes += chunk.length; if (captureBytes <= (heldLogout ? 16 : 128) * 1024) capture.push(chunk); else { incoming.destroy(); reject(Error("UPSTREAM_CAPTURE_CAP")); } }
              if (!selected && !heldLogout && !response.write(chunk)) { incoming.pause(); response.once("drain", () => incoming.resume()); }
            });
            incoming.once("error", error => downstreamClosed ? resolve() : reject(error));
            incoming.once("aborted", () => downstreamClosed ? resolve() : reject(Error("UPSTREAM_INCOMPLETE")));
            incoming.once("end", () => { track((async () => {
              record.complete = incoming.complete; record.responseSha256 = digest.digest("hex");
              if (record.sse) record.sse.endedAt = new Date().toISOString();
              if (!sse && !isSession) {
                const bytes = Buffer.concat(capture); captured += bytes.length; assert.ok(captured <= 2 * 1024 * 1024);
                if (/application\/json/i.test(String(incoming.headers["content-type"]))) record.response = JSON.parse(bytes.toString("utf8"));
                if (record.response && url.pathname === "/api/runners") delete record.response.token;
                if (selected) { assert.ok(record.status >= 200 && record.status < 300, "Selected upstream ACK was not successful"); await truncateAck(incoming, response, bytes, record); }
              }
              if (heldLogout) {
                assert.ok(incoming.complete && record.status === 200, "Held logout must be a real complete success");
                assert.equal(releaseHeldLogout, undefined);
                const bytes = Buffer.concat(capture);
                const held = { received: true, released: false, downstreamFinished: false, setCookie: incoming.headers["set-cookie"] !== undefined };
                record.logoutHold = held;
                // Hold the actual response before headers. Forward bytes and Set-Cookie unchanged on release.
                releaseHeldLogout = () => {
                  assert.ok(!response.destroyed && !response.headersSent); releaseHeldLogout = undefined; held.released = true;
                  response.writeHead(record.status, forwardHeaders(incoming.headers));
                  response.end(bytes, () => { held.downstreamFinished = true; resolve(); });
                };
                return;
              }
              if (!selected) response.end(); resolve();
            })().catch(reject)); });
            incoming.once("close", () => { if (record.sse) record.sse.closedAt = new Date().toISOString(); });
          });
          if (diagnostic) upstream.once("socket", socket => diagnostic.upstream(socket, wireIndex));
          upstreams.add(upstream); upstream.once("close", () => upstreams.delete(upstream));
          upstream.once("error", error => downstreamClosed ? resolve() : reject(error));
          response.once("close", () => { downstreamClosed = true; upstream.destroy(); resolve(); }); upstream.end(body);
        });
      } else {
        assert.ok(app && request.method === "GET", "App must be selected before asset access");
        const asset = await tools.releaseAsset(app.snapshot, url.pathname, String(request.headers.accept).includes("text/html"));
        if (!asset) { response.writeHead(404); response.end(); return; }
        response.writeHead(200, { "content-type": asset.path.endsWith(".html") ? "text/html; charset=utf-8" : asset.path.endsWith(".js") ? "text/javascript" : asset.path.endsWith(".css") ? "text/css" : "application/octet-stream", "cache-control": "no-store" }); response.end(asset.bytes);
      }
    })().catch(error => { if (!response.destroyed) { if (!response.headersSent) response.writeHead(502); response.end(); } throw error; }));
  });
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  server.on("connect", (_request, socket) => { if (rejected.length < 32) rejected.push("CONNECT"); socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); });
  try { port = await listen(server); } catch (error) { await closeServer(server, sockets).catch(() => {}); throw error; }
  return { url: `http://127.0.0.1:${port}`, canaryUrl: `http://127.0.0.1:${port}${canaryPath}`, records, errors, rejected,
    assertCanary() { assert.equal(canaryObserved, true, "Chrome must prove absolute-form proxy route before accessing public origin"); },
    select(value: LoadedApp) { app = value; legacy = false; faultArmed = false; },
    holdNextLogout() { assert.equal(logoutArmed, false); assert.equal(releaseHeldLogout, undefined); logoutArmed = true; },
    releaseLogout() { assert.ok(releaseHeldLogout, "No complete held response"); releaseHeldLogout(); },
    setLegacy(value: boolean) { legacy = value; }, arm() { assert.equal(faultArmed, false); faultArmed = true; },
    async settle() { await Promise.all([...pending]); assert.deepEqual(errors, []); },
    async close() {
      closing = true; logoutArmed = false; releaseHeldLogout = undefined;
      const upstreamClosed = [...upstreams].map(upstream => new Promise<void>(resolve => { upstream.once("close", resolve); }));
      for (const upstream of upstreams) upstream.destroy();
      await closeServer(server, sockets); await Promise.all(upstreamClosed); await Promise.allSettled([...pending]);
      assert.equal(sockets.size, 0); assert.equal(upstreams.size, 0);
    }
  };
}
export async function until<T>(read: () => Promise<T>, predicate: (value: T) => boolean, life: Lifetime, timeout = 10_000): Promise<T> {
  const end = performance.now() + timeout;
  do { await life.checkpoint(); const value = await read(); if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 30)); } while (performance.now() < end);
  throw Error("FIXTURE_CONDITION_DEADLINE");
}
export async function startReleaseFixture(input: Admission, adminUrl: string, life: Lifetime, recoveryApp?: AppInput, diagnosticPhase?: () => DiagnosticPhase) {
  life.signal.throwIfAborted(); await life.checkpoint();
  const outputInfo = await directory(input.output); assert.equal(outputInfo.mode & 0o077, 0); assert.deepEqual(await readdir(input.output), []);
  const tools = await runtime(input, life); const apps = await loadApps(input.apps, life, recoveryApp); await life.checkpoint();
  const adminIdentity = new URL(adminUrl); assert.ok(adminIdentity.protocol === "postgres:" || adminIdentity.protocol === "postgresql:");
  assert.equal(adminIdentity.hostname, "127.0.0.1", "Explicit owned test PG only"); assert.ok(adminIdentity.port && adminIdentity.pathname === "/postgres");
  const databaseName = `flow_release_${randomUUID().replaceAll("-", "")}`, marker = randomUUID(), token = `release-owned-${randomUUID()}`;
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${databaseName}`;
  const pool = (url: string) => new tools.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 3000 });
  const cleanup = { databaseName, marker, create: "NOT_STARTED", markerWritten: false, databaseRemoved: false, centerClosed: false, proxyClosed: false, errors: [] as string[] };
  let app: Center | undefined, front: Awaited<ReturnType<typeof proxy>> | undefined, closed = false;
  let diagnostic: ReturnType<typeof observeClientErrors> | undefined;
  let diagnosticResult: ReturnType<ReturnType<typeof observeClientErrors>["finish"]> | null = null;
  const close = async () => {
    if (closed) return cleanup; closed = true;
    if (front) try { await front.close(); cleanup.proxyClosed = true; } catch (error) { cleanup.errors.push("proxy:" + errorCode(error)); }
    if (app) try { await app.close(); cleanup.centerClosed = true; } catch (error) { cleanup.errors.push("center:" + errorCode(error)); }
    if (diagnostic) try {
      diagnosticResult = diagnostic.finish(); await saveJson(input.output, "http-client-errors.json", diagnosticResult);
      assert.equal(diagnosticResult.complete, true, "Incomplete passive clientError evidence");
    } catch (error) { cleanup.errors.push("client-error-evidence:" + errorCode(error)); }
    if (cleanup.create === "CONFIRMED" && cleanup.markerWritten) try {
      const own = pool(databaseUrl.href); try { assert.deepEqual((await own.query("SELECT id FROM public.release_fixture_owner")).rows, [{ id: marker }]); } finally { await own.end(); }
      const admin = pool(adminUrl); try {
        assert.deepEqual((await admin.query("SELECT pid FROM pg_stat_activity WHERE datname=$1", [databaseName])).rows, [], "Owned connections must close before DROP");
        await admin.query(`DROP DATABASE "${databaseName}"`); cleanup.databaseRemoved = (await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [databaseName])).rowCount === 0;
        assert.equal(cleanup.databaseRemoved, true);
      } finally { await admin.end(); }
    } catch (error) { cleanup.errors.push("database:" + errorCode(error)); }
    else if (cleanup.create !== "NOT_STARTED") cleanup.errors.push("database:UNKNOWN_CREATION_OR_MARKER_KEEP");
    await saveJson(input.output, "fixture-cleanup.json", cleanup); return cleanup;
  };
  try {
    await saveJson(input.output, "inputs.json", { backend: input.finalBackend, apps: input.apps, recoveryApp: recoveryApp ?? null, context: input.context, browserSettings: input.browserSettings, databaseName, marker, providerQueries: 0 });
    await life.checkpoint(); cleanup.create = "UNKNOWN"; const admin = pool(adminUrl);
    try { await admin.query(`CREATE DATABASE "${databaseName}"`); cleanup.create = "CONFIRMED"; } finally { await admin.end(); }
    await life.checkpoint(); const own = pool(databaseUrl.href);
    try { await own.query("CREATE TABLE public.release_fixture_owner(id uuid PRIMARY KEY)"); await own.query("INSERT INTO public.release_fixture_owner VALUES($1)", [marker]); cleanup.markerWritten = true; } finally { await own.end(); }
    await life.checkpoint(); app = await tools.createCenter({ databaseUrl: databaseUrl.href, ownerToken: token, browserSession: input.browserSettings, leaseMs: 300_000 });
    if (diagnosticPhase) diagnostic = observeClientErrors(app.server, diagnosticPhase);
    await life.checkpoint(); await app.listen({ host: "127.0.0.1", port: 0 }); await life.checkpoint();
    const address = app.server.address(); assert.ok(address && typeof address !== "string" && address.port !== 61228);
    const centerUrl = `http://127.0.0.1:${address.port}`; front = await proxy(address.port, input.context.publicOrigin, tools, life, diagnostic); await life.checkpoint();
    const owner = new tools.Client({ baseUrl: centerUrl, token });
    const runner = await owner.registerRunner({ name: "RELEASE01 fixed-origin deterministic runner", harnesses: ["claude"], capacity: 1 }); await life.checkpoint();
    const client = new tools.Client({ baseUrl: centerUrl, token: runner.token });
    const configuration = { harness: "claude", adapterVersion: tools.adapterVersion, model: "release-synthetic", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: hash("[]"), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } } as const;
    const { profile } = await client.publishExecutionProfile({ configuration }, life.signal); await life.checkpoint();
    const completeTask = async (taskId: string, text: string, whileRunning?: () => Promise<void>) => {
      const claimed = await until(() => client.claim(life.signal), value => value.assignment !== null, life); assert.ok(claimed.assignment);
      const assignment = claimed.assignment; assert.equal(assignment.task.id, taskId);
      const nativeSessionId = randomUUID(), sourceMessageId = randomUUID(), artifactId = randomUUID(), content = "Release fixture reply: " + text;
      const events = [
        { type: "session", nativeSessionId, adapterVersion: tools.adapterVersion, resources: ["owned compatibility fixture; zero provider"] },
        { type: "assistant-final", messageId: hash(JSON.stringify([nativeSessionId, sourceMessageId])), nativeSessionId, source: "claude.sdk.result", sourceMessageId, content,
          settings: { requested: { model: configuration.model, permissionMode: "dontAsk", thinking: "disabled" }, effective: { model: null, permissionMode: null, tools: null, thinking: "unknown" } } },
        { type: "artifact", artifactId, title: "Synthetic output", version: hash(content), content, mediaType: "text/plain" },
        tools.verifyText(artifactId, content, assignment.task.verification),
        { type: "completed", outcome: "succeeded" },
      ];
      // Public codec, not a fabricated page response, validates actual event types at the server.
      for (let sequence = 1; sequence <= events.length; sequence++) {
        const event = tools.parseEvent({ ...Object(events[sequence - 1]), id: randomUUID(), sequence });
        await client.report({ attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: [event] }, life.signal); await life.checkpoint();
        if (sequence === 1 && whileRunning) await whileRunning();
      }
    };
    const request = async (path: string) => { assert.ok(path.startsWith("/api/") && !path.includes("\\") && !path.includes("#")); await life.checkpoint();
      const result = await fetch(centerUrl + path, { headers: { authorization: `Bearer ${token}` }, redirect: "error", signal: life.signal }); assert.ok(result.ok); return result.json(); };
    return { apps, profile, token, proxy: front, request, completeTask, tools, close, input, diagnosticEvidence: () => diagnosticResult };
  } catch (error) { await close(); throw error; }
}
export type ReleaseFixture = Awaited<ReturnType<typeof startReleaseFixture>>;
