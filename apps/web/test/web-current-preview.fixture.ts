import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, realpath, lstat } from "node:fs/promises";
import { createServer as createHttpServer, request as requestHttp, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { FlowClient } from "../../../packages/client/src/index.js";
import { conversationCreationSchema, conversationTurnSchema, conversationContextReferenceSchema, contextHistoryResponseSchema, type ClaimedTask, type RunnerEventData } from "../../../packages/contracts/src/index.js";
import { CLAUDE_CONTEXT_SOURCE } from "../../../packages/contracts/src/context-observation-event.js";

export const BASE_BACKEND = "362af3bac77541e5a60979326bcf4d4b8c947915";
const HISTORY_FIX = "cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd";
const SOURCE_TARGET = "b29807979a5589678a61d3fb84781950cf366396";
const BACKEND_SOURCES = [
  { path: "apps/server/src/context-transparency/store.ts", sha256: "ec4ec2defd095739b2550814cc4324e00b2bcd31ae4b899de5ed983f92126245" },
  { path: "apps/server/src/context-transparency/attachment-history.test.ts", sha256: "4ae5fb30df18062159c3de1ec86e59d2db77f147e88d65a2dfb2b3582d50d96b" },
];
export type BackendInput = { path: string; head: string; tree: string; metadata: { path: string; sha256: string }[] };
export const repository = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = join(repository, "docs/evidence/wpf-release03");
export const ARTIFACT_ROOT = "/private/tmp/flow-release03-prepare-5069586-u1zh3mln/artifacts";
export const artifact = {
  artifactId: "d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88",
  sourceHead: "5069586a9f17332de526e101eca3a4250cbc8d91",
  manifestDigest: "d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88",
};
export const RELEASE_ID = "388371a4972c469b8ace623454594132";
export const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const failure = (error: unknown) => error instanceof Error ? error.message : String(error);
export const loadTool = (file: string) => import(pathToFileURL(join(repository, "tools/personal-preview", file)).href);
const execute = promisify(execFile);
export const git = async (...args: string[]) => (await execute("git", ["-C", repository, ...args], { maxBuffer: 1024 * 1024, timeout: 2000 })).stdout.trim();
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean, signal: AbortSignal, timeout = 8_000): Promise<T> {
  const deadline = Date.now() + timeout;
  do { signal.throwIfAborted(); const value = await read(); if (ready(value)) return value; await delay(40); } while (Date.now() < deadline);
  throw Error("Fixture condition timed out");
}

/** The trusted admission supplies the exact reviewed metadata closure, never the candidate itself. */
export async function verifyBackend(input: BackendInput) {
  assert.ok(isAbsolute(input.path)); assert.equal(await realpath(input.path), input.path, "Backend path must be its registered realpath");
  assert.match(input.head, /^[a-f0-9]{40}$/); assert.match(input.tree, /^[a-f0-9]{40}$/);
  const inspect = async (...args: string[]) => (await execute("git", ["-C", input.path, ...args], { maxBuffer: 1024 * 1024, timeout: 2000 })).stdout;
  const text = async (...args: string[]) => (await inspect(...args)).trim();
  const changed = async (from: string, to: string) => (await inspect("diff", "--name-only", "-z", from, to)).split("\0").filter(Boolean).sort();
  assert.equal(await realpath(await text("rev-parse", "--show-toplevel")), input.path);
  assert.equal(await text("rev-parse", "HEAD"), input.head, "Backend HEAD changed");
  assert.equal(await text("rev-parse", "HEAD^{tree}"), input.tree, "Backend tree changed");
  assert.equal(await text("status", "--porcelain"), "", "Backend source is dirty");
  assert.equal(await text("rev-list", "--parents", "-n", "1", SOURCE_TARGET), `${SOURCE_TARGET} ${BASE_BACKEND}`);
  await inspect("merge-base", "--is-ancestor", SOURCE_TARGET, input.head);
  assert.deepEqual(await changed(BASE_BACKEND, SOURCE_TARGET), BACKEND_SOURCES.map(file => file.path).sort());
  assert.ok(Array.isArray(input.metadata) && input.metadata.length <= 32, "Exact reviewed metadata closure required");
  for (const file of input.metadata) {
    assert.match(file.path, /^(?:docs\/evidence|plans)\/svc05-history-compatibility\/[a-z0-9-]+\.(?:json|md)$/);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(new Set(input.metadata.map(file => file.path)).size, input.metadata.length);
  assert.deepEqual(await changed(SOURCE_TARGET, input.head), input.metadata.map(file => file.path).sort());
  for (const file of [...BACKEND_SOURCES, ...input.metadata]) {
    const entry = (await inspect("ls-tree", "-z", input.head, "--", file.path)).split("\0");
    assert.equal(entry.length, 2); assert.equal(entry[1], "");
    assert.match(entry[0] ?? "", /^100644 blob [a-f0-9]{40}\t/); assert.equal(entry[0]?.split("\t")[1], file.path);
    const path = join(input.path, file.path); assert.equal(await realpath(path), path);
    const stat = await lstat(path); assert.ok(stat.isFile() && stat.size <= 256 * 1024);
    assert.equal(sha(await readFile(path)), file.sha256, `Backend bytes differ: ${file.path}`);
  }
  for (const file of BACKEND_SOURCES) assert.equal(await text("diff", HISTORY_FIX, input.head, "--", file.path), "");
  const factoryPath = join(input.path, "apps/server/src/index.ts");
  assert.equal(await realpath(factoryPath), factoryPath, "Factory path must remain inside the admitted tree");
  return { ...input, base: BASE_BACKEND, sourceTarget: SOURCE_TARGET, approvedHistorySource: HISTORY_FIX, sources: BACKEND_SOURCES, factoryPath };
}

export async function historyContract() {
  const bytes = await readFile(fileURLToPath(import.meta.url));
  const start = Buffer.from("// RELEASE03_HISTORY_CONTRACT_BEGIN\n"), end = Buffer.from("// RELEASE03_HISTORY_CONTRACT_END\n");
  const first = bytes.indexOf(start), last = bytes.indexOf(end);
  assert.ok(first >= 0 && last > first && bytes.lastIndexOf(start) === first && bytes.lastIndexOf(end) === last);
  return sha(bytes.subarray(first + start.length, last));
}

/** Local client/contracts/tools stay at 362; only the separately admitted factory receives the fixed correction. */
export async function sourceIdentity(backend: BackendInput) {
  const protectedPaths = ["apps/server", "packages/client", "packages/contracts", "tools/personal-preview", "pnpm-lock.yaml"];
  assert.equal(await git("diff", BASE_BACKEND, "--", ...protectedPaths), "", "Local fixed input changed");
  const backendInput = await verifyBackend(backend);
  const paths = ["apps/server/src/index.ts", "apps/server/src/context-transparency/store.ts", "packages/client/src/index.ts",
    "packages/client/src/conversation-acknowledgement.ts", "packages/contracts/src/conversation-context.ts",
    "tools/personal-preview/web-artifact.mjs", "tools/personal-preview/web-release.mjs", "tools/personal-preview/environment.mjs",
    "apps/web/test/web-current-preview.fixture.ts", "apps/web/test/web-current-preview.browser.ts"];
  return { head: await git("rev-parse", "HEAD"), backend: backend.head, sourceTree: backend.tree, backendInput,
    historyContractSha256: await historyContract(), artifact, releaseId: RELEASE_ID, harnessBase: BASE_BACKEND, dirty: await git("status", "--porcelain"),
    files: await Promise.all(paths.map(async path => ({ path, sha256: sha(await readFile(join(repository, path))) }))) };
}

export type Wire = {
  method: string; path: string; status: number; key: string | null; body: string; responseBody: string | null; responseSha256: string | null;
  stream: string | null; forwardedStream: string | null; profile: string | null; dropped: boolean;
  fault?: { kind: "truncated-ack-body"; contentLength: number; contentType: string; prefixBytes: number; prefixSha256: string;
    headersFlushed: boolean; prefixFlushed: boolean; endFlushed: boolean; socketClosed: boolean; error?: string };
};

/** Keep the real receipt in wire evidence; lose only a strict downstream body suffix. */
async function truncateAcknowledgement(incoming: IncomingMessage, response: ServerResponse, bytes: Buffer, record: Wire) {
  assert.ok(incoming.complete && bytes.length > 1 && bytes.length <= 128 * 1024, "Complete bounded upstream ACK required");
  assert.ok(!incoming.headers["content-encoding"] || incoming.headers["content-encoding"] === "identity", "Compressed ACK is not injectable");
  const contentType = incoming.headers["content-type"] ?? "";
  assert.match(contentType, /^application\/json(?:\s*;|$)/i);
  const length = incoming.headers["content-length"], transfer = incoming.headers["transfer-encoding"];
  assert.ok(!(length && transfer) && (!transfer || transfer.toLowerCase() === "chunked"), "Ambiguous upstream framing");
  if (length !== undefined) { assert.match(length, /^\d+$/); assert.equal(Number(length), bytes.length); }
  assert.ok(bytes.equals(Buffer.from(bytes.toString("utf8"))), "ACK must be valid UTF8");
  const ack = JSON.parse(bytes.toString("utf8"));
  assert.ok(ack && typeof ack === "object" && !Array.isArray(ack));
  assert.equal(typeof (/\/turns$/.test(record.path) ? ack.turn?.id : ack.item?.id), "string", "Real accepted identity required");
  const socket = response.socket; assert.ok(socket && !socket.destroyed);
  const prefix = bytes.subarray(0, 1);
  const fault: NonNullable<Wire["fault"]> = { kind: "truncated-ack-body", contentLength: bytes.length, contentType,
    prefixBytes: prefix.length, prefixSha256: sha(prefix), headersFlushed: false, prefixFlushed: false, endFlushed: false, socketClosed: false };
  record.fault = fault;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { fault.error = "ACK fault close deadline"; socket.destroy(); }, 1000);
    response.once("error", error => { fault.error = failure(error); socket.destroy(); });
    socket.once("error", error => { fault.error = failure(error); });
    socket.once("close", hadError => {
      clearTimeout(timeout); fault.socketClosed = true;
      if (hadError || fault.error || !fault.prefixFlushed || !fault.endFlushed) reject(Error(fault.error ?? "ACK fault closed before local flush"));
      else resolve();
    });
    response.writeHead(record.status, { "content-type": contentType, "content-length": bytes.length, "connection": "close", "cache-control": "no-store" });
    response.flushHeaders(); fault.headersFlushed = true;
    response.write(prefix, error => {
      if (error) { fault.error = failure(error); socket.destroy(); return; }
      fault.prefixFlushed = true;
      socket.end(() => { fault.endFlushed = true; });
    });
  });
}
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
  const address = server.address(); assert.ok(address && typeof address !== "string"); return address.port;
}
async function closeHttp(server: Server) {
  server.closeAllConnections();
  if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

/** Static bytes only: no Vite, release pointer, install, source copy, or fabricated compatibility record. */
async function previewHost(centerPort: number, signal: AbortSignal) {
  signal.throwIfAborted();
  const { verifyWebArtifact } = await loadTool("web-artifact.mjs");
  const { releaseAsset } = await loadTool("web-release.mjs");
  signal.throwIfAborted();
  const { dist, manifest } = await verifyWebArtifact({ directory: ARTIFACT_ROOT, artifact });
  signal.throwIfAborted();
  assert.equal(manifest.format, 2); assert.equal(manifest.releaseId, RELEASE_ID);
  type File = { path: string; bytes: number; sha256: string };
  const files = manifest.files as File[];
  const index = files.find(file => file.path === "index.html"); assert.ok(index);
  const snapshot = { index: { ...index, path: join(dist, index.path) }, assets: new Map(files.filter(file => file !== index)
    .map(file => [`/__flow_releases/${RELEASE_ID}/${file.path}`, { ...file, path: join(dist, file.path) }])) };
  const wire: Wire[] = []; const problems: string[] = []; let captureBytes = 0; let legacy = false; let drop: "turn" | "queue" | null = null;
  const upstreams = new Set<ReturnType<typeof requestHttp>>();
  const faultWrites = new Set<Promise<void>>();
  const server = createHttpServer((request, response) => {
    void (async () => {
      const path = request.url ?? "/";
      if (!/^\/api(?:\/|$)/.test(path)) {
        if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
        if (path === "/__flow_preview_identity") { response.setHeader("content-type", "application/json"); response.end(JSON.stringify(artifact)); return; }
        const file = await releaseAsset(snapshot, path.split("?")[0], request.headers.accept?.includes("text/html"));
        if (!file) { response.writeHead(404).end(); return; }
        const mime: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
        response.writeHead(200, { "content-type": mime[extname(file.path)] ?? "application/octet-stream", "cache-control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : file.bytes); return;
      }
      const chunks: Buffer[] = []; let count = 0;
      for await (const chunk of request) { count += chunk.length; assert.ok(count <= 64 * 1024, "Request capture limit"); chunks.push(chunk); }
      assert.ok(wire.length < 1000 && captureBytes < 2 * 1024 * 1024, "Wire evidence limit");
      const body = Buffer.concat(chunks).toString("utf8"); const headers = { ...request.headers };
      if (legacy) delete headers["x-flow-assistant-stream"];
      const inject = request.method === "POST" && (drop === "turn" && /\/turns$/.test(path) || drop === "queue" && /\/queue$/.test(path));
      if (inject) drop = null;
      const upstream = requestHttp({ hostname: "127.0.0.1", port: centerPort, path, method: request.method, headers }, incoming => {
        const json = incoming.headers["content-type"]?.includes("application/json");
        const capture: Buffer[] = []; let received = 0;
        const dropped = inject && (incoming.statusCode ?? 500) >= 200 && (incoming.statusCode ?? 500) < 300;
        if (inject && !dropped) problems.push(`ACK fault requires real upstream success: ${path}`);
        if (!dropped) response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.on("data", (chunk: Buffer) => {
          if (json) { received += chunk.length; if (received <= 128 * 1024) capture.push(chunk); }
          // SSE is forwarded incrementally, never buffered behind end or a JSON timeout.
          if (!dropped) response.write(chunk);
        });
        incoming.on("end", () => {
          let responseBody = json && received <= 128 * 1024 ? Buffer.concat(capture).toString("utf8") : null;
          const responseSha256 = responseBody === null ? null : sha(responseBody);
          // Registration is the only response carrying an ephemeral credential. Never persist it.
          if (path === "/api/runners" && responseBody) {
            try { const registration = JSON.parse(responseBody); delete registration.token; responseBody = JSON.stringify(registration); }
            catch { responseBody = null; problems.push("Malformed runner registration JSON"); }
          }
          const record: Wire = { method: request.method ?? "GET", path, status: incoming.statusCode ?? 502, body, responseBody, responseSha256, dropped,
            key: request.headers["idempotency-key"] ? String(request.headers["idempotency-key"]) : null,
            stream: request.headers["x-flow-assistant-stream"] ? String(request.headers["x-flow-assistant-stream"]) : null,
            forwardedStream: headers["x-flow-assistant-stream"] ? String(headers["x-flow-assistant-stream"]) : null,
            profile: request.headers["x-flow-execution-profile"] ? String(request.headers["x-flow-execution-profile"]) : null };
          const recordBytes = Buffer.byteLength(JSON.stringify(record)); captureBytes += recordBytes;
          if (captureBytes > 2 * 1024 * 1024 || wire.length >= 1000) { problems.push("Wire evidence limit exceeded"); response.destroy(); return; }
          wire.push(record);
          if (dropped) {
            if (!json || received > 128 * 1024 || !incoming.complete) { problems.push("ACK fault requires complete bounded JSON"); response.destroy(); return; }
            const write = truncateAcknowledgement(incoming, response, Buffer.concat(capture), record)
              .catch(error => { problems.push(`ACK fault: ${failure(error)}`); response.destroy(); })
              .finally(() => { captureBytes += Buffer.byteLength(JSON.stringify(record)) - recordBytes; if (captureBytes > 2 * 1024 * 1024) problems.push("Wire evidence limit exceeded"); });
            faultWrites.add(write); void write.finally(() => faultWrites.delete(write));
          } else response.end();
        });
        incoming.on("error", () => { if (!signal.aborted && !response.destroyed) problems.push(`Upstream response interrupted: ${path}`); response.destroy(); });
      });
      upstreams.add(upstream); upstream.once("close", () => upstreams.delete(upstream));
      upstream.on("error", () => { if (!response.destroyed && !signal.aborted) { problems.push(`Upstream request failed: ${path}`); response.writeHead(502).end(); } });
      response.on("close", () => upstream.destroy()); upstream.end(body);
    })().catch(error => { problems.push(failure(error)); if (!response.destroyed) response.writeHead(503).end(); });
  });
  signal.addEventListener("abort", () => { for (const upstream of upstreams) upstream.destroy(); server.closeAllConnections(); }, { once: true });
  try {
    signal.throwIfAborted();
    const port = await listen(server);
    signal.throwIfAborted();
    return { url: `http://127.0.0.1:${port}`, manifest, wire, problems, loseNext: (kind: "turn" | "queue") => { assert.equal(drop, null); drop = kind; },
      setLegacy: (value: boolean) => { legacy = value; }, close: async () => { for (const upstream of upstreams) upstream.destroy(); await closeHttp(server); await Promise.all(faultWrites); } };
  } catch (error) { await closeHttp(server); throw error; }
}

export async function startCurrentPreview(databaseUrl: string, token: string, signal: AbortSignal, backend: BackendInput) {
  signal.throwIfAborted();
  const identity = await verifyBackend(backend);
  signal.throwIfAborted();
  const { createServer }: typeof import("../../server/src/index.js") = await import(pathToFileURL(identity.factoryPath).href);
  signal.throwIfAborted();
  const app = await createServer({ databaseUrl, ownerToken: token, leaseMs: 300_000 });
  let preview: Awaited<ReturnType<typeof previewHost>> | undefined;
  try {
    signal.throwIfAborted(); await app.listen({ host: "127.0.0.1", port: 0 });
    signal.throwIfAborted();
    const address = app.server.address(); assert.ok(address && typeof address !== "string");
    preview = await previewHost(address.port, signal);
    signal.throwIfAborted();
    const owner = new FlowClient({ baseUrl: preview.url, token });
    return { ...preview, owner, token, backend: identity, async close() {
      const errors: string[] = [];
      try { await preview?.close(); } catch (error) { errors.push(failure(error)); }
      try { await app.close(); } catch (error) { errors.push(failure(error)); }
      assert.deepEqual(errors, [], "Owned factory/HTTP cleanup failed");
    } };
  } catch (error) { await preview?.close(); await app.close(); throw error; }
}
export type CurrentPreview = Awaited<ReturnType<typeof startCurrentPreview>>;

// RELEASE03_HISTORY_CONTRACT_BEGIN
export async function syntheticRunner(fixture: CurrentPreview, label: string, signal: AbortSignal) {
  const registration = await fixture.owner.registerRunner({ name: `RELEASE03 ${label}`, harnesses: ["claude"], capacity: 1 });
  const client = new FlowClient({ baseUrl: fixture.url, token: registration.token });
  const configuration = { harness: "claude", adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion, model: `release-synthetic-${label}`,
    thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: sha("[]"),
    limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } } as const;
  const { profile } = await client.publishExecutionProfile({ configuration }, signal);
  const claim = async (taskId: string) => {
    const result = await until(() => client.claim(signal), value => value.assignment !== null, signal);
    assert.ok(result.assignment); assert.equal(result.assignment.task.id, taskId); return result.assignment;
  };
  const report = (assignment: ClaimedTask, sequence: number, data: RunnerEventData) => client.report({ attemptId: assignment.attempt.id,
    ownerVersion: assignment.attempt.ownerVersion, events: [{ ...data, id: randomUUID(), sequence }] }, signal);
  return { client, profile, configuration, claim, report };
}

export async function createMaterials(fixture: CurrentPreview, title: string, signal: AbortSignal) {
  const { snapshot: { project } } = await fixture.owner.createProject({ workspaceId: "personal", title }, randomUUID(), signal);
  const capabilities = await fixture.owner.attachmentCapabilities(project.id, signal);
  const text = `PRIVATE_ATTACHMENT_${title}_資料🙂`;
  const accepted = await fixture.owner.uploadAttachment(project.id, { recoveryScopeId: capabilities.recoveryScopeId,
    name: "existing.txt", mediaType: "text/plain", text, byteLength: Buffer.byteLength(text), contentDigest: sha(text) }, randomUUID(), signal);
  return { projectId: project.id, text, resource: accepted.resource, ref: accepted.resource.reference };
}

export function factRecord(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function wireResponse(value: unknown) {
  const row = factRecord(value); assert.ok(typeof row.responseBody === "string");
  assert.ok(typeof row.status === "number" && row.status >= 200 && row.status < 300); assert.equal(row.dropped, false);
  assert.equal(sha(row.responseBody), row.responseSha256);
  return factRecord(JSON.parse(row.responseBody));
}

/** One set of facts for the live A and subsequent pinned-evidence reuse. */
export function assertHistoryFacts(value: unknown, captured: unknown, backend: BackendInput) {
  const facts = factRecord(value); assert.ok(facts.label === "attachment-only" || facts.label === "mixed");
  const mixed = facts.label === "mixed";
  assert.equal(facts.backend, backend.head); assert.equal(facts.backendTree, backend.tree);
  assert.equal(facts.factoryPath, join(backend.path, "apps/server/src/index.ts")); assert.equal(facts.providerQueries, 0);
  assert.equal(facts.reportError, undefined, "Actual reportEvents rejected the native observation"); assert.equal(facts.error, undefined);
  assert.deepEqual(facts.report, { accepted: 1, lastSequence: 2 });
  const context = conversationContextReferenceSchema.parse(facts.context); assert.equal(context.templateVersion, 2);
  assert.ok("attachments" in context); assert.equal(context.attachments.length, 1); assert.equal(context.sources.length, mixed ? 1 : 0);
  const history = contextHistoryResponseSchema.parse(facts.history);
  assert.equal(history.taskId, facts.taskId); assert.equal(history.attemptId, facts.attemptId);
  assert.equal(JSON.stringify(history).includes("PRIVATE_"), false); assert.ok(history.latest);
  assert.deepEqual(history.latest.materials, { state: "unknown", reason: "metadata-unavailable" });
  assert.equal(history.latest.observation.identity.materialRevisionDigest, null);
  assert.equal(history.latest.observation.identity.executionInputDigest, context.executionInputDigest);
  const subject = history.latest.observation.identity.subject; assert.equal(subject.kind, "attempt");
  assert.ok("taskId" in subject); assert.equal(subject.taskId, facts.taskId); assert.equal(subject.attemptId, facts.attemptId);
  assert.ok(Array.isArray(captured) && Array.isArray(facts.wireRange) && facts.wireRange.length === 2);
  const [start, end] = facts.wireRange;
  assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= captured.length);
  const rows = captured.slice(start, end).map(factRecord);
  const one = (method: string, path: string) => {
    const found = rows.filter(row => row.method === method && row.path === path); assert.equal(found.length, 1); return found[0]!;
  };
  const admission = one("POST", `/api/conversations/${facts.conversationId}/turns`);
  const request = conversationTurnSchema.parse(JSON.parse(String(admission.body)));
  assert.equal(request.attachments?.length, 1); assert.equal(request.knowledge?.length ?? 0, mixed ? 1 : 0);
  assert.deepEqual(request.attachments, context.attachments.map(item => item.reference));
  assert.deepEqual(request.knowledge ?? [], context.sources.map(item => item.citation));
  const turn = factRecord(wireResponse(admission).turn); assert.equal(factRecord(turn.task).id, facts.taskId); assert.deepEqual(turn.context, facts.context);
  const reports = rows.filter(row => row.method === "POST" && row.path === "/api/runner/events").filter(row => {
    const body = factRecord(JSON.parse(String(row.body))); assert.equal(body.attemptId, facts.attemptId);
    return Array.isArray(body.events) && body.events.some(event => factRecord(event).type === "context-observation");
  });
  assert.equal(reports.length, 1); const report = reports[0]!;
  const eventBody = factRecord(JSON.parse(String(report.body))); assert.equal(eventBody.ownerVersion, subject.ownerVersion);
  assert.ok(Array.isArray(eventBody.events) && eventBody.events.length === 1);
  const event = factRecord(eventBody.events[0]); assert.equal(event.sequence, 2);
  assert.equal(factRecord(event.observation).observationId, history.latest.observation.id);
  assert.deepEqual(wireResponse(report), facts.report);
  assert.deepEqual(wireResponse(one("GET", `/api/tasks/${facts.taskId}/context/history`)), facts.history);
  const detail = wireResponse(one("GET", `/api/conversations/${facts.conversationId}/contexts/${context.id}`));
  // ConversationContextDetail is a body response, not an execution-input reference.
  // Match its frozen metadata to the already validated accepted reference.
  assert.equal(detail.id, context.id); assert.equal(detail.conversationId, facts.conversationId);
  assert.equal(detail.projectId, context.attachments[0]!.reference.projectId); assert.equal(detail.contextDigest, context.contextDigest);
  assert.equal(detail.templateVersion, 2); assert.equal(detail.order, context.order);
  assert.ok(typeof detail.createdAt === "string" && Number.isFinite(Date.parse(detail.createdAt)));
  assert.ok(Array.isArray(detail.attachments)); assert.equal(detail.attachments.length, context.attachments.length);
  for (const [index, value] of detail.attachments.entries()) {
    const { text, ...descriptor } = factRecord(value); assert.deepEqual(descriptor, context.attachments[index]);
    assert.equal(text, `PRIVATE_ATTACHMENT_${facts.label}_資料🙂`); assert.ok(typeof text === "string");
    assert.equal(Buffer.byteLength(text), context.attachments[index]!.byteLength);
    assert.equal(sha(text), context.attachments[index]!.reference.contentDigest);
  }
  assert.ok(Array.isArray(detail.sources)); assert.equal(detail.sources.length, context.sources.length);
  for (const [index, value] of detail.sources.entries()) {
    const { text, currentVersion, isCurrent, ...source } = factRecord(value); assert.deepEqual(source, context.sources[index]);
    assert.equal(text, "PRIVATE_KNOWLEDGE_資料🙂"); assert.ok(typeof text === "string");
    assert.equal(Buffer.byteLength(text), context.sources[index]!.byteLength);
    assert.ok(typeof currentVersion === "number" && Number.isInteger(currentVersion) && currentVersion >= context.sources[index]!.citation.version);
    assert.equal(isCurrent, currentVersion === context.sources[index]!.citation.version);
  }
}

/** Each case is independent. Failure remains a release blocker even if later App checks pass. */
export async function checkHistory(fixture: CurrentPreview, mixed: boolean, signal: AbortSignal) {
  const start = fixture.wire.length; const label = mixed ? "mixed" : "attachment-only";
  const facts: Record<string, unknown> = { label, backend: fixture.backend.head, backendTree: fixture.backend.tree, factoryPath: fixture.backend.factoryPath, providerQueries: 0 };
  try {
    const runner = await syntheticRunner(fixture, label, signal);
    const materials = await createMaterials(fixture, label, signal);
    const knowledgeText = "PRIVATE_KNOWLEDGE_資料🙂";
    const source = mixed ? await fixture.owner.createKnowledgeSource(materials.projectId, { expectedVersion: 0, title: "Frozen knowledge", text: knowledgeText }, randomUUID(), signal) : null;
    const knowledge = source ? [{ projectId: materials.projectId, sourceId: source.source.id, version: 1, contentDigest: sha(knowledgeText),
      locator: { kind: "utf8-bytes" as const, start: 0, end: Buffer.byteLength(knowledgeText) } }] : undefined;
    const created = await fixture.owner.createConversation(conversationCreationSchema.parse({ title: label, projectId: materials.projectId,
      executionProfile: runner.profile.reference }), randomUUID(), signal);
    const accepted = await fixture.owner.submitConversationTurn(created.conversation.id, conversationTurnSchema.parse({ expectedRevision: 0,
      text: `Use ${label} materials`, attachments: [materials.ref], ...(knowledge ? { knowledge } : {}) }), randomUUID(), signal);
    const context = accepted.turn.context; assert.ok(context && context.templateVersion === 2);
    const assignment = await runner.claim(accepted.turn.task.id); const nativeSessionId = randomUUID();
    Object.assign(facts, { conversationId: created.conversation.id, taskId: assignment.task.id, attemptId: assignment.attempt.id, context: accepted.turn.context });
    assert.equal(assignment.conversationContext?.executionInputDigest, context.executionInputDigest);
    assert.ok(assignment.task.prompt.includes(materials.text)); if (mixed) assert.ok(assignment.task.prompt.includes(knowledgeText));
    await runner.report(assignment, 1, { type: "session", nativeSessionId, adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion });
    try {
      facts.report = await runner.report(assignment, 2, { type: "context-observation", observation: { source: CLAUDE_CONTEXT_SOURCE,
        observationId: randomUUID(), observedAt: new Date().toISOString(), nativeSessionId, resolvedModel: "synthetic-resolved-model",
        used: 123, compactionWindow: 1000, categories: [{ kind: "used", tokens: 123 }] } });
    } catch (error) { facts.reportError = failure(error); }
    // Read even when reportEvents failed, preserving both HTTP outcomes and the actual task.
    const history = await fixture.owner.contextHistory(assignment.task.id, signal); facts.history = history;
    facts.task = await fixture.owner.show(assignment.task.id, signal);
    await fixture.owner.conversationContext(created.conversation.id, context.id, signal);
    Object.assign(facts, { wireRange: [start, fixture.wire.length] });
    assertHistoryFacts(facts, fixture.wire, fixture.backend);
    return { ...facts, passed: true };
  } catch (error) { return { ...facts, passed: false, error: failure(error), wireRange: [start, fixture.wire.length] }; }
}
// RELEASE03_HISTORY_CONTRACT_END
