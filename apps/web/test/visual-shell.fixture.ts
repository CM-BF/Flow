import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { NativeActivity, NativeActivityReference } from "@flow/contracts";
import { startStreamPreview } from "./conversation-stream-integration.fixture";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const longReply = `# A quiet workspace for a long conversation

Keep the interface in the background. The document, the current question, and the next useful action should stay easy to find.

## Decisions from this review

| Surface | Treatment | Purpose |
| --- | --- | --- |
| Navigation | Compact neutral chrome | Find and switch conversations |
| Conversation | Opaque reading surface | Read long replies without visual noise |
| Tools | Collapsed observations | Inspect only when useful |

\`\`\`typescript
const panes = views.map(view => ({
  id: view.id,
  title: view.title,
  visible: view.isVisible,
}));
// A long line should scroll inside the code block, without widening the page.
const example = "A deliberately long example that stays within its own horizontal code scroller: " + "abcdefghijklmnopqrstuvxyz";
\`\`\`

${Array.from({ length: 7 }, (_, n) => `### Review note ${n + 1}\n\nA real conversation grows over time. Keep a stable reading width, a clear focus boundary, and enough space between paragraphs to scan the result. The shell should stay compact while the content remains comfortable to read.`).join("\n\n")}
`;

/** Real product App and public HTTP contracts; all content is synthetic, no model or DB. */
export async function startVisualPreview(production = false) {
  const preview = await startStreamPreview(production);
  const activityReads: string[] = [];
  for (const [index, center] of [preview.first, preview.second].entries()) {
    const chat = center.chats.get("chat-3")!;
    preview.streams[index]!.seed(chat.turns[0]!);
    preview.streams[index]!.finish(chat.turns[0]!.task.id, longReply);
    const taskId = chat.turns[0]!.task.id;
    const rows: NativeActivityReference[] = ["tool", "thinking"].map((kind, n) => {
      const id = digest(`${index}:${taskId}:${kind}`);
      return { id, activityId: id, taskId, attemptId: "visual-attempt", eventId: `visual-event-${n}`, sequence: n,
        createdAt: chat.turns[0]!.createdAt, nativeSessionId: `visual-session-${index}`, source: "claude.sdk.message",
        sourceMessageId: `visual-source-${n}`, nativeMessageId: null, blockIndex: n, parentToolUseId: null,
        kind: kind as "tool" | "thinking", phase: kind === "tool" ? "input-ready" : "observed",
        toolUseId: kind === "tool" ? "visual-tool" : null, toolName: kind === "tool" ? "Read design notes" : null,
        detail: { id: `visual-detail-${n}`, title: "Synthetic activity" }, status: kind === "tool" ? "input-ready" : "observed" };
    });
    const bodies = new Map<string, NativeActivity>(rows.map(row => {
      const content = row.kind === "tool" ? '{"path":"docs/design-notes.md"}' : "Synthetic provider thinking: compare the compact shell with an opaque reading surface.";
      return [row.id, { ...row, body: { content, mediaType: row.kind === "tool" ? "application/json" : "text/plain", originalBytes: Buffer.byteLength(content), truncated: false, sha256: digest(content) } }];
    }));
    const handler = center.server.listeners("request")[0] as (request: IncomingMessage, response: ServerResponse) => void;
    center.server.removeAllListeners("request");
    center.server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", "http://fixture");
      const isList = url.pathname === `/api/tasks/${taskId}/native-activities`;
      const bodyId = /^\/api\/native-activities\/([^/]+)$/.exec(url.pathname)?.[1];
      if (!isList && !bodyId) { handler(request, response); return; }
      activityReads.push(url.pathname);
      response.setHeader("access-control-allow-origin", "*");
      response.setHeader("access-control-allow-headers", "authorization,content-type");
      if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
      const result = isList ? { activities: rows, nextCursor: null } : bodies.get(bodyId!);
      response.writeHead(result ? 200 : 404, { "content-type": "application/json" }); response.end(JSON.stringify(result ?? { error: { code: "not_found", message: "Synthetic observation missing" } }));
    });
  }
  return { ...preview, activityReads };
}
if (process.argv.includes("--visual-preview")) {
  const preview = await startVisualPreview(process.argv.includes("--production"));
  console.log(`Visual shell actual App / synthetic HTTP fixture: ${preview.url}`);
  const stop = async () => { await preview.close(); process.exit(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
