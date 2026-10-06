import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssistantStreamPatch, AssistantStreamReference, AssistantStreamPage, ConversationTurn } from "@flow/contracts";
import { createConversationFixture } from "./conversation.fixture";
import { startQueuePreview } from "./conversation-queue.fixture";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export function installStreamFixture(fixture: ReturnType<typeof createConversationFixture>, label = "A") {
  const handler = fixture.server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const streams = new Map<string, { turn: ConversationTurn; patches: AssistantStreamPatch[]; metadata: AssistantStreamPage }>();
  const reads: { taskId: string; kind: string; after: number }[] = [], headers: { method: string; path: string; protocol: string | undefined }[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>(); let capability = true, auto = false, delay = 0, fail = false, inflight = 0, peak = 0;
  const later = (callback: () => void, ms: number) => { const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms); timers.add(timer); };
  const seed = (turn: ConversationTurn) => {
    turn.task.status = "running"; turn.assistant = { state: "pending", reason: "execution-pending" };
    const task = fixture.tasks.get(turn.task.id); if (task) task.status = "running";
    const metadata: AssistantStreamPage = { taskId: turn.task.id, attemptId: `${turn.task.id}-attempt`, taskStatus: "running", taskUpdatedAt: turn.task.updatedAt, blocks: [], nextCursor: null, finalMessageId: null, settlement: null };
    streams.set(turn.task.id, { turn, patches: [], metadata }); return turn.task.id;
  };
  const append = (taskId: string, text: string, phase: AssistantStreamPatch["phase"] = "streaming", block = 0, truncated = false) => {
    const stream = streams.get(taskId)!; const old = stream.patches.filter(patch => patch.blockIndex === block), prior = old.at(-1), content = old.map(patch => patch.text).join("") + text;
    const at = new Date().toISOString(), streamId = hash(JSON.stringify([`${label}-session`, `${taskId}-native`, block]));
    const patch: AssistantStreamPatch = { type: "assistant-stream", taskId, attemptId: stream.metadata.attemptId!, nativeSessionId: `${label}-session`, nativeMessageId: `${taskId}-native`, parentToolUseId: null,
      source: "claude.sdk.stream", sourceMessageId: `${label}-source-${stream.patches.length}`, streamId, blockIndex: block, revision: (prior?.revision ?? 0) + 1,
      fromBytes: Buffer.byteLength(old.map(patch => patch.text).join("")), text, prefixDigest: hash(content), phase, reason: phase === "incomplete" ? "aborted" : phase === "superseded" ? "superseded" : null,
      truncated, eventId: `${taskId}-patch-${stream.patches.length}`, sequence: (stream.patches.at(-1)?.sequence ?? 0) + 3, createdAt: at };
    stream.patches.push(patch);
    const { type: _type, text: _text, fromBytes: _fromBytes, eventId: _eventId, sequence, createdAt, ...header } = patch;
    const reference: AssistantStreamReference = { ...header, id: streamId, firstSequence: old[0]?.sequence ?? sequence, lastSequence: sequence, bytes: Buffer.byteLength(content), createdAt, updatedAt: at, status: phase };
    stream.metadata.blocks = [...stream.metadata.blocks.filter(ref => ref.id !== streamId), reference].sort((a,b) => a.firstSequence - b.firstSequence);
    stream.turn.task.updatedAt = at; stream.metadata.taskUpdatedAt = at; return patch;
  };
  const finish = (taskId: string, text: string, replace = true) => {
    const stream = streams.get(taskId)!, turn = stream.turn, id = `${taskId}-final`, detailId = `${taskId}-final-detail`;
    const at = new Date().toISOString(); turn.task.updatedAt = at;
    turn.assistant = { state: "available", role: "assistant", messageId: id, text, truncated: false, contentRef: { id: detailId, title: "Full reply", kind: "detail", taskId, attemptId: stream.metadata.attemptId! },
      source: { kind: "assistant-final", source: "claude.sdk.result", taskId, attemptId: stream.metadata.attemptId!, nativeSessionId: `${label}-session`, messageId: id, eventId: `${taskId}-result`, sourceMessageId: `${taskId}-result-source`, contentDigest: hash(text), detailId } };
    fixture.details.set(detailId, { id: detailId, title: "Full reply", kind: "detail", content: text, mediaType: "text/plain" });
    stream.metadata.finalMessageId = id; stream.metadata.taskUpdatedAt = at;
    stream.metadata.settlement = { policy: "flow.assistant-draft", policyVersion: "1", correlation: replace ? "presentation-policy" : "unavailable", unavailableReason: replace ? null : "missing-tool-evidence", taskId,
      attemptId: stream.metadata.attemptId!, nativeSessionId: `${label}-session`, finalMessageId: id, replaceStreamIds: replace ? stream.metadata.blocks.map(ref => ref.id) : [], retainStreamIds: replace ? [] : stream.metadata.blocks.map(ref => ref.id) };
  };
  fixture.server.on("request", (req,res) => {
    const url = new URL(req.url ?? "/", "http://fixture"), match = /^\/api\/tasks\/([^/]+)\/assistant-stream(\/patches)?$/.exec(url.pathname);
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "authorization,content-type,idempotency-key,x-flow-assistant-stream" }); res.end(); return; }
    if (!match) {
      if (url.pathname.startsWith("/api/conversations")) {
        headers.push({ method: req.method ?? "GET", path: url.pathname, protocol: req.headers["x-flow-assistant-stream"]?.toString() });
        const end = res.end.bind(res);
        res.end = ((chunk: unknown, ...args: unknown[]) => {
          if (typeof chunk === "string" && req.method === "GET" && /^\/api\/conversations\/[^/]+$/.test(url.pathname)) {
            const payload = JSON.parse(chunk); if (payload.capabilities) payload.capabilities.liveAssistantText = capability && req.headers["x-flow-assistant-stream"] === "patch-v1";
            chunk = JSON.stringify(payload);
          }
          if (auto && req.method === "POST" && url.pathname.endsWith("/turns")) {
            const turn = fixture.chats.get(decodeURIComponent(url.pathname.split("/")[3]!))?.snapshot.lastTurn;
            if (turn && !streams.has(turn.task.id)) { const taskId = seed(turn); append(taskId, `${label}: Thinking through your question`); later(() => append(taskId, " — one step at a time."), 500); later(() => { append(taskId,"","block-complete"); finish(taskId, `${label}: Here is the complete reply to “${turn.user.text}”.`); }, 3500); }
          }
          return Reflect.apply(end, res, [chunk, ...args]);
        }) as typeof res.end;
      }
      handler(req,res); return;
    }
    res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-headers", "authorization,content-type,x-flow-assistant-stream");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const taskId = decodeURIComponent(match[1]!), stream = streams.get(taskId), after = Number(url.searchParams.get("after") ?? 0);
    reads.push({ taskId, kind: match[2] ? "patches" : "metadata", after });
    inflight++; peak = Math.max(peak, inflight); res.once("close", () => { inflight--; });
    const respond = (value: unknown) => later(() => { if (!res.destroyed) { res.writeHead(fail ? 503 : 200, { "content-type": "application/json" }); res.end(JSON.stringify(fail ? { error: { code: "unavailable", message: "Fixture stream unavailable" } } : value)); } }, delay);
    if (!stream) { respond({ taskId, attemptId: null, taskStatus: fixture.tasks.get(taskId)?.status ?? "running", taskUpdatedAt: new Date().toISOString(), blocks: [], nextCursor: null, finalMessageId: null, settlement: null }); return; }
    if (!match[2]) { respond(structuredClone(stream.metadata)); return; }
    const all = stream.patches.filter(patch => patch.sequence > after), patches = all.slice(0,8);
    respond({ taskId, attemptId: stream.metadata.attemptId, patches, nextCursor: patches.at(-1)?.sequence ?? after, hasMore: all.length > 8 });
  });
  return { streams, reads, headers, seed, append, finish, setCapability(value: boolean) { capability=value; }, setAuto(value: boolean) { auto=value; }, setDelay(ms: number) { delay=ms; }, setFailure(value: boolean) { fail=value; }, get peak() { return peak; }, close() { timers.forEach(clearTimeout); } };
}
export async function startStreamPreview(production = false) {
  const preview = await startQueuePreview(production), first = installStreamFixture(preview.first,"A"), second = installStreamFixture(preview.second,"B");
  for (const [fixture,stream] of [[preview.first,first],[preview.second,second]] as const) { const id=stream.seed(fixture.chats.get("chat-2")!.turns[0]!); stream.append(id,"A reply in progress"); stream.setAuto(true); }
  return { ...preview, streams:[first,second], close: async()=>{first.close();second.close();await preview.close();} };
}
if(process.argv.includes("--stream-preview")){const preview=await startStreamPreview();console.log(`Assistant stream HTTP fixture (simulated, no model/DB): ${preview.url}`);console.log(`Centers ${preview.centers.join(", ")}; public token flow-fixture-only`);const stop=async()=>{await preview.close();process.exit();};process.once("SIGTERM",stop);process.once("SIGINT",stop);}
