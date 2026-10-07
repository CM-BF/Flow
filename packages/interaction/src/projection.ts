import type { ConversationTurn } from '@flow/contracts';
import { settingsEvidence } from './message-settings/index.js';
import type { TurnView } from './types.js';
export function boundedText(value: string, bytes = 8192): { text: string; truncated: boolean } {
  if (Buffer.byteLength(value, 'utf8') <= bytes) return { text: value, truncated: false };
  let text = ''; let used = 0;
  for (const character of value) { const size = Buffer.byteLength(character); if (used + size > bytes) break; used += size; text += character; }
  return { text, truncated: true };
}
/** Display-only escape rendering; raw request/history text never passes through this function. */
export function terminalText(value: string): string {
  return value.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
export function turnView(turn: ConversationTurn): TurnView {
  const user = boundedText(turn.user.text, 4096);
  const reply = turn.assistant;
  const valid = reply.state === 'available' && reply.source.taskId === turn.task.id && reply.contentRef.taskId === turn.task.id && reply.source.attemptId === reply.contentRef.attemptId;
  const text = valid ? boundedText(reply.text) : null;
  return { id: turn.id, number: turn.number, taskId: turn.task.id, status: turn.task.status, userText: user.text + (user.truncated ? '\n[truncated]' : ''),
    assistant: { state: valid ? 'available' : reply.state === 'available' ? 'unavailable' : reply.state, text: text?.text ?? null,
      truncated: Boolean(text?.truncated || valid && reply.truncated), messageId: valid ? reply.messageId : null }, effectiveModel: turn.effective.model,
    ...(turn.messageSettings !== undefined || turn.effective.messageSettings !== undefined ? { messageSettings: settingsEvidence(turn) } : {}) };
}
