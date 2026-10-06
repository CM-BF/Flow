import { z } from 'zod';
import { executionProfileReferenceSchema, idSchema, type ConversationSummary } from '@flow/contracts';
import type { Intent } from './types.js';
// Validate fields actually consumed or bound to the immutable request. Unknown additive fields remain compatible.
const summary = z.object({
  id: z.uuid(), title: z.string().min(1).max(180), harness: z.literal('claude'),
  requested: z.object({ model: z.string().min(1).max(180), thinking: z.enum(['disabled', 'enabled', 'adaptive']), tools: z.enum(['configured-readonly', 'none']) }),
  executionProfile: executionProfileReferenceSchema.optional(), projectId: idSchema.optional(),
  revision: z.number().int().min(0).max(2_147_483_646), createdAt: z.string().min(1).max(80), updatedAt: z.string().min(1).max(80),
});
const receipt = z.object({ conversation: summary, replayed: z.boolean() });
const creationReceipt = receipt.extend({ capabilities: z.object({ followUp: z.literal(true) }) });
const turnReceipt = receipt.extend({ turn: z.object({ id: z.uuid(), conversationId: z.uuid(), number: z.number().int().positive(),
  user: z.object({ role: z.literal('user'), text: z.string().min(1).max(16_000) }), task: z.object({ id: z.uuid() }),
}) });
function same(value: unknown, expected: unknown) { return JSON.stringify(value) === JSON.stringify(expected); }
/** Must succeed before discarding the only durable recovery identity. It is not task completion. */
export function acknowledgedConversation(intent: Intent, value: unknown): ConversationSummary {
  if (intent.kind === 'create') {
    const { conversation } = creationReceipt.parse(value);
    const { title, harness, requested, executionProfile, projectId } = conversation;
    if (conversation.revision !== 0 || !same({ title, harness, requested, executionProfile, projectId },
      { title: intent.input.title, harness: intent.input.harness, requested: intent.input.requested, executionProfile: intent.input.executionProfile, projectId: intent.input.projectId })) {
      throw new Error('Creation acknowledgement does not match the original request');
    }
    return conversation;
  }
  const { conversation, turn } = turnReceipt.parse(value);
  if (conversation.id !== intent.conversationId || turn.conversationId !== intent.conversationId
    || conversation.revision !== intent.input.expectedRevision + 1 || turn.number !== conversation.revision || turn.user.text !== intent.input.text) {
    throw new Error('Turn acknowledgement does not match the original request');
  }
  return conversation;
}
