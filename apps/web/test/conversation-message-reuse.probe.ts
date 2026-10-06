import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import type { ExternalStoreAdapter, INTERNAL, ThreadMessageLike } from "@assistant-ui/react";
import type { ConversationSnapshot, ConversationTurn } from "@flow/contracts";
import { conversationMessages } from "../src/conversations/messages";
import { ConversationProjection } from "../src/conversations/projection";

const BASE = "30b97cbf3665c4ef7a314a6a8b59394ae68781af";
const at = "2026-10-06T07:00:00Z";
export function makeTurn(number = 1, text = `Reply ${number}`): ConversationTurn {
  return { id: `turn-${number}`, conversationId: "conversation-1", number, createdAt: at,
    user: { role: "user", text: `Question ${number}` },
    task: { id: `task-${number}`, title: "Question", harness: "claude", status: "succeeded", verificationStatus: "pending", createdAt: at, updatedAt: at },
    assistant: { state: "available", role: "assistant", messageId: `reply-${number}`, text, truncated: true,
      contentRef: { kind: "artifact", id: `detail-${number}`, title: "Full reply", taskId: `task-${number}`, attemptId: "attempt-1" },
      source: { kind: "adapter-final-artifact", adapterVersion: "claude-sdk-0.3.290-v1", taskId: `task-${number}`, attemptId: "attempt-1", artifactId: `artifact-${number}`, artifactVersion: "v1", detailId: `detail-${number}` } },
    effective: { model: null, thinking: "unknown", tools: "unknown", source: null },
    telemetry: { kind: "execution", taskId: `task-${number}`, title: "Execution details" } };
}

/** Actual projection with synthetic in-memory HTTP-shaped responses; no server/model. */
export function projectionFixture(initial: ConversationTurn[]) {
  let turns = initial;
  const requests = { snapshots: 0, pages: 0, details: 0 };
  const summary = () => ({ id: "conversation-1", title: "Fixture", harness: "claude" as const,
    requested: { model: "runner-default", thinking: "disabled" as const, tools: "configured-readonly" as const },
    revision: turns.at(-1)?.number ?? 0, createdAt: at, updatedAt: at });
  const snapshot = (): ConversationSnapshot => ({ conversation: summary(), nativeSession: null, lastTurn: turns.at(-1) ?? null,
    capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false } });
  const client: ConstructorParameters<typeof ConversationProjection>[0] = {
    conversation: async () => { requests.snapshots++; return structuredClone(snapshot()); },
    conversationTurns: async (_id, options) => {
      requests.pages++;
      const page = turns.filter(turn => turn.number > (options?.after ?? 0)).slice(0, options?.limit ?? 20);
      return structuredClone({ conversation: summary(), turns: page, nextCursor: page.length && page.at(-1)!.number < (turns.at(-1)?.number ?? 0) ? page.at(-1)!.number : null });
    },
    conversationDetail: async (_conversation, turnId, detailId) => {
      requests.details++; const turn = turns.find(turn => turn.id === turnId)!;
      assert.equal(turn.assistant.state, "available");
      return { id: detailId, kind: "artifact", title: "Full reply", content: `Full ${turnId}`, mediaType: "text/plain", artifactVersion: "v1" };
    },
    createConversation: async () => { throw Error("Probe never creates a conversation"); },
    submitConversationTurn: async () => { throw Error("Probe never sends to a center"); },
  };
  return { projection: new ConversationProjection(client, "conversation-1"), requests, replace: (next: ConversationTurn[]) => { turns = next; } };
}

type Adapter = ExternalStoreAdapter<ThreadMessageLike>;
type Core = { threads: { getMainThreadRuntimeCore(): INTERNAL.ThreadRuntimeCore }; setAdapter(adapter: Adapter): void };
const fromReact = createRequire(createRequire(import.meta.url).resolve("@assistant-ui/react"));
const coreEntry = fromReact.resolve("@assistant-ui/core/internal");
const coreRoot = resolve(dirname(coreEntry), "..");
const coreVersion = JSON.parse(readFileSync(resolve(coreRoot, "package.json"), "utf8")).version;

/** Fixed installed internal runtime is used only by this measurement/test helper. */
export async function coreFixture(messages: ThreadMessageLike[]) {
  assert.equal(coreVersion, "0.3.22", "Re-audit the probe when the installed runtime changes");
  const { ExternalStoreRuntimeCore } = await import(pathToFileURL(coreEntry).href) as { ExternalStoreRuntimeCore: new (adapter: Adapter) => Core };
  let calls = 0;
  const convertMessage = (message: ThreadMessageLike) => { calls++; return message; };
  const adapter: Adapter = { messages, convertMessage, isRunning: false, onNew: async () => {} };
  const core = new ExternalStoreRuntimeCore(adapter);
  return { thread: core.threads.getMainThreadRuntimeCore(),
    update: (next: ThreadMessageLike[], extra: Partial<Adapter> = {}) => core.setAdapter({ ...adapter, messages: next, ...extra }),
    takeCalls: () => { const value = calls; calls = 0; return value; } };
}

type Convert = typeof conversationMessages;
async function measure(convert: Convert) {
  const fixture = projectionFixture(Array.from({ length: 100 }, (_, i) => makeTurn(i + 1)));
  try {
    await fixture.projection.refresh();
    while (fixture.projection.getSnapshot().nextCursor !== null) await fixture.projection.loadMore();
    let previous = convert(fixture.projection.getSnapshot().turns);
    const core = await coreFixture(previous);
    const warmupCalls = core.takeCalls();
    const unchanged = [];
    for (let pass = 0; pass < 3; pass++) {
      await fixture.projection.refresh();
      const next = convert(fixture.projection.getSnapshot().turns);
      core.update(next);
      unchanged.push({ messageCount: next.length, sameMessageObjects: next.filter((message, i) => message === previous[i]).length, converterCalls: core.takeCalls() });
      previous = next;
    }
    fixture.replace(Array.from({ length: 100 }, (_, i) => makeTurn(i + 1, i === 99 ? "Changed final reply" : `Reply ${i + 1}`)));
    await fixture.projection.refresh();
    const changed = convert(fixture.projection.getSnapshot().turns); core.update(changed);
    const update = { sameMessageObjects: changed.filter((message, i) => message === previous[i]).length, converterCalls: core.takeCalls(), finalText: core.thread.messages.at(-1)?.content[0] };
    core.thread.composer.setText("Unsent next draft");
    core.update(changed, { isRunning: true }); const running = { converterCalls: core.takeCalls(), status: core.thread.messages.at(-1)?.status };
    core.update(changed, { isRunning: false }); const stopped = { converterCalls: core.takeCalls(), status: core.thread.messages.at(-1)?.status };
    return { warmupCalls, unchanged, update, running, stopped, draft: core.thread.composer.text, requests: fixture.requests };
  } finally { fixture.projection.dispose(); }
}

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function main() {
  const sourcePath = "apps/web/src/conversations/messages.ts";
  const baselineSource = execFileSync("git", ["show", `${BASE}:${sourcePath}`], { encoding: "utf8" });
  const js = ts.transpileModule(baselineSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText;
  const baseline = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`) as { conversationMessages: Convert };
  const runtimePath = "src/runtimes/external-store/external-store-thread-runtime-core.ts";
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "Actual installed runtime + actual ConversationProjection; synthetic in-memory responses. Counts only, no React rendering or latency measurement.",
    versions: { node: process.version, core: coreVersion },
    sources: { baseline: sha(baselineSource), current: sha(readFileSync(sourcePath)), probe: sha(readFileSync("apps/web/test/conversation-message-reuse.probe.ts")), core: { path: resolve(coreRoot, runtimePath), sha256: sha(readFileSync(resolve(coreRoot, runtimePath))) } },
    baseline: await measure(baseline.conversationMessages), candidate: await measure(conversationMessages) }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
