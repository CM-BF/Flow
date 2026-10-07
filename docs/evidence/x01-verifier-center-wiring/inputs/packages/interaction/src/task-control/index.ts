import { z } from 'zod';
import type { FlowClient } from '@flow/client';

export type TaskControlPort = Pick<FlowClient, 'cancel'>;

/** Local recovery identity. The public cancel API accepts only taskId, key and an empty body. */
export const taskCancelIntentSchema = z.strictObject({
  version: z.literal(1), connectionId: z.string().min(1).max(160), key: z.uuid(),
  kind: z.literal('task-cancel'), conversationId: z.uuid(), turnId: z.uuid(), taskId: z.uuid(),
  input: z.strictObject({}),
});
export type TaskCancelIntent = z.infer<typeof taskCancelIntentSchema>;

const receiptSchema = z.object({
  id: z.uuid(),
  status: z.enum(['cancel_requested', 'cancelled', 'succeeded', 'failed', 'uncertain']),
});

/** A valid receipt acknowledges this task-scoped command; it never proves a runner stopped. */
export async function dispatchTaskCancel(port: TaskControlPort, intent: TaskCancelIntent, signal: AbortSignal): Promise<void> {
  const receipt = receiptSchema.parse(await port.cancel(intent.taskId, intent.key, signal));
  if (receipt.id !== intent.taskId) throw Error('Cancellation receipt identity mismatch');
}
