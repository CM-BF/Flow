import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer as createViteServer, type Plugin } from "vite";
import { attachmentUploadSchema, type AttachmentAccepted, type AttachmentMetadata, type ClaudeMessageSettingsExecutionProfile } from "@flow/contracts";
import { createConversationFixture } from "./conversation.fixture";
import { installStreamFixture } from "./conversation-stream-integration.fixture";

/** Classify public API paths, never similarly named Vite modules or list reads. */
export function workspaceReadKind(pathname: string): "body" | "stream" | null {
  if (/^\/api\/details\/[^/]+$/.test(pathname)
    || /^\/api\/conversations\/[^/]+\/(?:turns\/[^/]+\/details\/[^/]+|queue\/[^/]+)$/.test(pathname)) return "body";
  return /^\/api\/tasks\/[^/]+\/stream$/.test(pathname) ? "stream" : null;
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const probeId = "\0virtual:arc-material-probe";
// This fixture-only wrapper waits after the real adapter has validated a real upload.
// It neither replaces business HTTP nor reads/writes App drafts, ownership or IDB.
const probeSource = String.raw`
let armed=false, release, timer, disposed=false;
const rows=[], ready=[];
export function arm(){if(disposed||armed||release||rows.length>=2)throw Error("Arc probe bound");armed=true;}
export function observe(item){if(ready.length>=8)throw Error("Arc upload witness bound");ready.push(structuredClone(item));}
export function snapshot(){return {armed,pending:!!release,rows:rows.map(row=>({...row})),ready:structuredClone(ready)};}
export function settle(){if(!release)throw Error("No real adapter pending");release();}
export async function hold(signal){
 if(!armed)return;armed=false;const row={validated:true,aborted:false,returned:false};rows.push(row);
 await new Promise((resolve,reject)=>{
  const finish=error=>{clearTimeout(timer);signal?.removeEventListener("abort",abort);release=undefined;error?reject(error):resolve();};
  const abort=()=>{row.aborted=true;finish(Error("Original composer lifetime aborted"));};
  release=()=>finish();timer=setTimeout(()=>finish(Error("Arc material hold deadline")),20000);
  signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)abort();
 });row.returned=true;
}
export function dispose(){disposed=true;armed=false;if(release){clearTimeout(timer);release();}removeEventListener("pagehide",dispose);}
addEventListener("pagehide",dispose,{once:true});
`;
function materialWitness(root: string): Plugin {
  return { name: "arc-real-material-await", enforce: "pre",
    resolveId(source) { if (source === "virtual:arc-material-probe") return probeId; },
    load(source) { if (source === probeId) return probeSource; },
    transform(code, source) {
      if (source.split("?")[0] !== root + "/src/attachments/adapter.ts") return;
      const declaration = "export function createAttachmentAdapter(";
      assert.equal(code.split(declaration).length, 2, "Pinned real attachment adapter declaration");
      return { code: `import {hold,observe} from "virtual:arc-material-probe";\n` + code.replace(declaration, "function originalCreateAttachmentAdapter(") + `
export function createAttachmentAdapter(input: AttachmentInput): AttachmentAdapter {
 const original=originalCreateAttachmentAdapter(input);
 return {...original,async *add(options){for await(const value of original.add(options)){
  if(value.status.type==="requires-action"){const item=input.getSnapshot().items.find(item=>item.id===value.id);if(!item?.metadata)throw Error("Real upload required");observe({id:item.id,name:item.name,reference:item.metadata.reference});}yield value;
 }},async send(attachment,options){const result=await original.send(attachment,options);await hold(options?.signal);return result;}};
}`, map: null };
    },
  };
}
export async function startWorkspaceLayoutFixture(options: { cacheDirectory: string }) {
  const fixture = createConversationFixture(), stream = installStreamFixture(fixture, "Arc");
  fixture.setReplyDelay(600000);
  const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
  const at = new Date().toISOString(), projectId = "arc-project", recoveryScopeId = id(3);
  const choices = ["arc-A", "arc-B", "arc-C"].map(model => ({ model, thinking: "disabled" as const, effort: { kind: "not-requested" as const }, speed: "standard" as const }));
  const configuration: ClaudeMessageSettingsExecutionProfile["configuration"] = {
    harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: "arc-A", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false,
    materialScopeDigest: "a".repeat(64), turnSettings: { protocol: "flow.claude-turn-settings.v1", choices }, limits: { maxTurns: 1, maxBudgetUsd: .01, timeoutMs: 1000 },
  };
  const profile: ClaudeMessageSettingsExecutionProfile = { reference: { id: id(4), runnerId: id(5), configDigest: hash(JSON.stringify(configuration)) }, configuration,
    source: "runner-configured", availability: "not-probed", model: { value: "arc-A", resolvedModel: null, displayName: "Arc fixture profile", description: "Synthetic public projection; no runner registration or execution", providerCapabilities: "unknown" },
    controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: "flow.claude-turn-settings.v1", choices: "configuration.turnSettings.choices" } }, createdAt: at };
  for (const chat of fixture.chats.values()) {
    chat.snapshot.conversation = { ...chat.snapshot.conversation, projectId, executionProfile: profile.reference };
    chat.snapshot.capabilities = { ...chat.snapshot.capabilities, queue: true, attachmentContext: true,
      messageSettings: { protocol: "flow.claude-turn-settings.v1", profile: profile.reference, choices: "execution-profile" } };
  }
  const streamTasks = [1, 2, 3].map(number => {
    // One exact long reply per pane; no selector depends on an unrelated starter turn.
    const chat = fixture.chats.get(`chat-${number}`)!;
    chat.turns.length = 0; chat.snapshot.lastTurn = null;
    chat.snapshot.conversation = { ...chat.snapshot.conversation, revision: 0 };
    fixture.addTurn(`chat-${number}`, `long reply ${number}`, true);
    return stream.seed(fixture.addTurn(`chat-${number}`, `Live Arc ${number}`, false));
  });
  for (const task of streamTasks) for (let n = 0; n < 81; n++) stream.append(task, ` patch-${n}`);
  stream.setDelay(8);
  const handler = fixture.server.listeners("request")[0] as (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
  fixture.server.removeAllListeners("request");
  const uploads = new Map<string, AttachmentAccepted>(), files = new Map<string, AttachmentMetadata>();
  const reads: { method: string; path: string; bytes: number; bodyRead: boolean; ended: boolean }[] = [];
  const errors: string[] = [];
  let cookie: string | undefined, csrf: string | undefined, bodyInFlight = 0, bodyPeak = 0, bodyBytes = 0, closed = false;
  let web: Awaited<ReturnType<typeof createViteServer>> | undefined;
  const observationStart = performance.now();
  let observationPhase = "connection";
  const bodyEvents: { sequence: number; elapsedMs: number; event: string; path: string; phase: string; inFlight: number; status?: number }[] = [];
  const observe = (event: string, path: string, status?: number) => {
    if (bodyEvents.length >= 128) { if (!errors.includes("Arc body/stream event bound")) errors.push("Arc body/stream event bound"); return; }
    bodyEvents.push({ sequence: bodyEvents.length + 1, elapsedMs: performance.now() - observationStart, event, path, phase: observationPhase, inFlight: bodyInFlight, status });
  };
  let expectedBodies: Set<string> | undefined, releasedBodies = 0;
  const seenBodies = new Set<string>();
  const heldBodies = new Map<string, { response: ServerResponse; send: () => void }>();
  // Count-limited real responses, bounded by the existing whole-worker deadline.
  // The browser releases one available response at a time; six server arrivals are never a release prerequisite.
  const bodyResponse = (path: string, response: ServerResponse, send: () => void) => {
    bodyInFlight++; bodyPeak = Math.max(bodyPeak, bodyInFlight); observe("body-arrive", path);
    response.once("finish", () => observe("body-finish", path, response.statusCode));
    response.once("close", () => { bodyInFlight--; if (heldBodies.get(path)?.response === response) heldBodies.delete(path); observe("body-close", path, response.statusCode); });
    if (!expectedBodies) { send(); return; }
    assert.ok(expectedBodies.has(path) && !seenBodies.has(path), "One exact body request per identity");
    assert.ok(heldBodies.size < 6 && seenBodies.size < 6, "Arc body hold bound");
    seenBodies.add(path); heldBodies.set(path, { response, send }); observe("body-held", path);
  };
  const json = (response: ServerResponse, value: unknown, status = 200) => { if (!response.destroyed) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(value)); } };
  const body = async (request: IncomingMessage) => { const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of request) { bytes += chunk.length; if (bytes > 32768) throw Error("Arc request bound"); chunks.push(Buffer.from(chunk)); }
    return Buffer.concat(chunks).toString("utf8");
  };
  fixture.server.on("request", (request, response) => { void (async () => {
    const url = new URL(request.url ?? "/", "http://fixture"), method = request.method ?? "GET";
    if (reads.length >= 768) throw Error("Arc HTTP observation bound");
    const kind = workspaceReadKind(url.pathname);
    const row = { method, path: url.pathname, bytes: 0, bodyRead: kind === "body", ended: false }; reads.push(row);
    const originalEnd = response.end.bind(response);
    response.end = ((chunk: unknown, ...args: unknown[]) => {
      if (typeof chunk === "string" || Buffer.isBuffer(chunk)) { row.bytes += Buffer.byteLength(chunk); if (row.bodyRead) bodyBytes += Buffer.byteLength(chunk); }
      return Reflect.apply(originalEnd, response, [chunk, ...args]);
    }) as typeof response.end;
    response.once("close", () => { row.ended = true; });
    if (kind === "stream") {
      observe("stream-arrive", url.pathname);
      response.once("finish", () => observe("stream-finish", url.pathname, response.statusCode));
      response.once("close", () => observe("stream-close", url.pathname, response.statusCode));
    }
    const ready = () => ({ protocol: "flow.browser-session.v1", state: "ready", centerId: id(1), ownerPrincipalId: id(2), csrfToken: csrf, expiresAt: new Date(Date.now() + 3600000).toISOString() });
    const authenticated = cookie !== undefined && request.headers.cookie?.split(/;\s*/).includes(`flow_arc_fixture=${cookie}`);
    if (url.pathname === "/api/browser-session" && method === "GET") { json(response, authenticated ? ready() : { protocol: "flow.browser-session.v1", state: "unauthenticated" }); return; }
    if (url.pathname === "/api/browser-session/connect" && method === "POST" && request.headers.authorization === "Bearer flow-fixture-only") {
      await body(request); cookie = randomUUID(); csrf = "b".repeat(64); response.setHeader("set-cookie", `flow_arc_fixture=${cookie}; HttpOnly; SameSite=Strict; Path=/`); json(response, ready()); return;
    }
    if (!authenticated || method !== "GET" && request.headers["x-flow-csrf"] !== csrf) { json(response, { error: { code: "unauthorized", message: "Synthetic Cookie session required" } }, 401); return; }
    request.headers.authorization = "Bearer flow-fixture-only"; // Trusted fixture-only translation after Cookie/CSRF checks.
    if (url.pathname === "/api/execution-profiles") { json(response, { protocol: "flow.claude-turn-settings.v1", profiles: [{ profile, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" } }], nextCursor: null }); return; }
    const material = `/api/projects/${projectId}/attachments`;
    if (url.pathname.startsWith(material)) {
      const suffix = url.pathname.slice(material.length);
      if (suffix === "/capabilities") { json(response, { protocol: "text-v1", recoveryScopeId, projectId, requiresProject: true, mediaTypes: ["text/plain"], extensions: [".txt"], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192, order: "knowledge-then-attachments", unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 }); return; }
      if (!suffix && method === "POST") {
        const input = attachmentUploadSchema.parse(JSON.parse(await body(request))), key = String(request.headers["idempotency-key"] ?? "");
        assert.equal(input.recoveryScopeId, recoveryScopeId); assert.equal(hash(input.text), input.contentDigest); assert.ok(key && uploads.size < 8);
        const previous = uploads.get(key); if (previous) { assert.equal(previous.requestDigest, hash(JSON.stringify(input))); json(response, { ...previous, replayed: true }); return; }
        const resource: AttachmentMetadata = { reference: { kind: "upload", projectId, resourceId: randomUUID(), version: 1, contentDigest: input.contentDigest }, name: input.name, mediaType: "text/plain", byteLength: input.byteLength, state: "ready", retained: false, createdAt: at, expiresAt: new Date(Date.now() + 3600000).toISOString() };
        const accepted = { uploadKey: key, recoveryScopeId, requestDigest: hash(JSON.stringify(input)), resource, replayed: false }; uploads.set(key, accepted); files.set(resource.reference.resourceId, resource); json(response, accepted, 201); return;
      }
      if (!suffix && method === "GET") { json(response, { resources: [...files.values()], nextCursor: null }); return; }
      const resource = files.get(suffix.slice(1)); if (resource && method === "GET") { json(response, resource); return; }
      json(response, { error: { code: "attachment_not_found", message: "No synthetic resource" } }, 404); return;
    }
    const queue = /^\/api\/conversations\/(chat-[1-8])\/queue(?:\/(.+))?$/.exec(url.pathname);
    if (queue && method === "GET") {
      const conversationId = queue[1]!, text = `Waiting ${conversationId} ` + "body ".repeat(240);
      const item = { id: `${conversationId}-queue`, conversationId, sequence: 1, state: "waiting", preview: text.slice(0, 100), truncated: true, promoted: null, createdAt: at, updatedAt: at };
      const value = { conversationId, queueRevision: 1, paused: true, currentTurn: null, blocked: "queue-paused", ...(queue[2] ? { item: { ...item, text } } : { items: [item], nextCursor: null }) };
      if (queue[2]) bodyResponse(url.pathname, response, () => json(response, value));
      else json(response, value); return;
    }
    if (method === "POST" && /\/conversations\/[^/]+\/turns$/.test(url.pathname)) {
      const end = response.end.bind(response);
      response.end = ((chunk: unknown) => {
        const value = JSON.parse(String(chunk));
        const input = JSON.parse(fixture.requests.findLast(row => row.key === request.headers["idempotency-key"] && row.method === "POST")?.body ?? "{}");
        if (value.turn) {
          const descriptors = (input.attachments ?? []).map((ref: { resourceId: string }) => { const file = files.get(ref.resourceId); assert.ok(file); const { reference, name, mediaType, byteLength } = file; return { reference, name, mediaType, byteLength }; });
          if (descriptors.length) value.turn.context = { id: randomUUID(), contextDigest: "c".repeat(64), executionInputId: randomUUID(), executionInputDigest: "d".repeat(64), templateVersion: 2, order: "knowledge-then-attachments", sources: [], attachments: descriptors };
          if (input.messageSettings) value.turn.messageSettings = input.messageSettings;
          const saved = fixture.chats.get(value.turn.conversationId)?.turns.find(turn => turn.id === value.turn.id); if (saved) Object.assign(saved, value.turn);
        }
        return end(JSON.stringify(value));
      }) as typeof response.end;
    }
    const run = () => { if (!response.destroyed) Promise.resolve(handler(request, response)).catch(failed); };
    const failed = (error: unknown) => { if (errors.length < 8) errors.push(String(error).slice(0, 256)); if (response.headersSent) response.destroy(); else json(response, { error: { code: "arc_fixture", message: "Fixture request failed" } }, 500); };
    if (row.bodyRead) bodyResponse(url.pathname, response, run);
    else run();
  })().catch(error => { if (errors.length < 8) errors.push(String(error).slice(0, 256)); if (response.headersSent) response.destroy(); else json(response, { error: { code: "arc_fixture", message: "Fixture request failed" } }, 500); }); });
  const close = async () => {
    if (closed) return; closed = true;
    for (const { response } of heldBodies.values()) response.destroy();
    heldBodies.clear(); expectedBodies = undefined; stream.close();
    const results = await Promise.allSettled([web?.close(), fixture.close()]);
    const failures = results.filter(result => result.status === "rejected"); if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Arc HTTP cleanup failed");
  };
  try {
    await new Promise<void>((resolve, reject) => { fixture.server.once("error", reject); fixture.server.listen(0, "127.0.0.1", () => { fixture.server.off("error", reject); resolve(); }); });
    const center = fixture.server.address(); assert.ok(center && typeof center !== "string");
    web = await createViteServer({ root, configLoader: "native", cacheDir: options.cacheDirectory, plugins: [materialWitness(root)],
      define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy: { "/api": `http://127.0.0.1:${center.port}` } }, logLevel: "error" });
    await web.listen(); const address = web.httpServer!.address(); assert.ok(address && typeof address !== "string");
    return { fixture, stream, streamTasks, profile, choices, reads, errors, uploads, files, ports: [center.port, address.port], url: `http://127.0.0.1:${address.port}`,
      holdBodyReads(paths: readonly string[]) {
        assert.ok(!closed && !expectedBodies && bodyInFlight === 0 && seenBodies.size === 0);
        assert.equal(paths.length, 6); assert.equal(new Set(paths).size, 6);
        expectedBodies = new Set(paths);
      },
      heldBodyPaths: () => [...heldBodies.keys()],
      releaseNextBody() {
        const next = heldBodies.entries().next().value; assert.ok(next && expectedBodies && releasedBodies < 6);
        const [path, held] = next; assert.ok(!held.response.destroyed);
        heldBodies.delete(path); releasedBodies++; observe("body-release", path); held.send(); return path;
      },
      finishBodyReads() {
        assert.equal(releasedBodies, 6); assert.equal(seenBodies.size, 6);
        assert.equal(heldBodies.size, 0); assert.equal(bodyInFlight, 0); expectedBodies = undefined;
      },
      setObservationPhase(value: string) { observationPhase = value; },
      bodyEvents, bodyMetrics: () => ({ bodyInFlight, bodyPeak, bodyBytes }), close };
  } catch (error) { try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], "Arc setup/cleanup failed"); } throw error; }
}
