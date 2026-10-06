import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { queueJourney } from './queue-journey.mjs';
const root = '/Users/citrine/Projects/AgentHarness/Flow';
const output = new URL('./queue-live-preflight/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const { startQueuePreview } = await import(pathToFileURL(`${root}/apps/web/test/conversation-queue.fixture.ts`).href);
const preview = await startQueuePreview();
const fixture = preview.first, nonce = 'flow-zero-model-队列-7e91';
const evidence = { kind: 'synthetic browser rehearsal', sourceMain: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), modelCalls: 0, realCenter: false, startedAt: new Date().toISOString(), steps: [], browsers: [], pageErrors: [] };
const template = structuredClone(fixture.chats.get('chat-2').turns[0]);
const read = async path => { const response = await fetch(preview.centers[0] + path, { headers: { authorization: 'Bearer flow-fixture-only' } }); assert.equal(response.ok, true); return response.json(); };
function finish(id, number, text) {
  const turn = fixture.chats.get(id).turns[number - 1], task = fixture.tasks.get(turn.task.id);
  task.status = 'succeeded'; task.updatedAt = new Date().toISOString(); turn.task = { ...task };
  const taskId = task.id, attemptId = `${taskId}-attempt`, messageId = `${taskId}-message`, detailId = `${taskId}-reply`;
  turn.assistant = { ...structuredClone(template.assistant), text, truncated: false, messageId, contentRef: { id: detailId, title: 'Assistant reply', kind: 'detail', taskId, attemptId }, source: { ...template.assistant.source, taskId, attemptId, messageId, detailId, nativeSessionId: `${id}-session`, eventId: `${taskId}-event`, sourceMessageId: `${taskId}-source`, contentDigest: createHash('sha256').update(text).digest('hex') } };
  turn.effective = { ...structuredClone(template.effective), source: { ...template.effective.source, taskId, attemptId, messageId, detailId } };
  fixture.details.set(detailId, { id: detailId, title: 'Assistant reply', kind: 'detail', mediaType: 'text/plain', content: text });
}
try {
  await queueJourney({ webUrl: preview.url, token: 'flow-fixture-only', nonce, read, output, evidence,
    beforeContinue: async ({ conversationId }) => { finish(conversationId, 1, '已记住'); evidence.steps.push({ name: 'fixture-only: first reply published; no SDK usage assertion', at: new Date().toISOString() }); },
    afterContinue: async ({ conversationId }) => { const turn = fixture.chats.get(conversationId).turns[1]; fixture.setCurrentStatus(conversationId, 'running'); turn.assistant = { state: 'pending', reason: 'execution-pending' }; },
    afterBrowserClose: async ({ conversationId }) => { finish(conversationId, 2, nonce); },
  });
  evidence.status = 'PASSED_SYNTHETIC_ONLY';
} catch (error) { evidence.status = 'FAILED_SYNTHETIC'; evidence.error = String(error); process.exitCode = 1; }
finally { await preview.close(); evidence.endedAt = new Date().toISOString(); await writeFile(`${output}/checks.json`, JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify({ status: evidence.status, error: evidence.error, steps: evidence.steps.length, modelCalls: 0 })); }
