import { z } from 'zod';
import type { CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { codexAssistantSettingsSchema } from '../../../../../packages/contracts/src/assistant.js';
import type { Json } from '../../codex/types.js';

export const nativeId = z.string().min(1).max(128).refine(value => Buffer.byteLength(value) <= 128);
export const nativeRecord = z.record(z.string(), z.unknown());
const threadReceipt = z.object({ thread: z.object({ id: nativeId }), ...codexAssistantSettingsSchema.shape.observedThreadConfiguration.unwrap().shape });
const turnReceipt = z.object({ turn: z.object({ id: nativeId, status: z.enum(['inProgress', 'completed', 'failed', 'interrupted']),
  itemsView: z.enum(['notLoaded', 'summary', 'full']), items: z.array(z.unknown()).max(1000), error: z.union([z.null(), nativeRecord]) }) });

/** Select only public observed configuration; discard native paths, instruction sources and diagnostics. */
export function readThreadReceipt(value: Json) {
  const { thread, ...observedThreadConfiguration } = threadReceipt.parse(value);
  return { threadId: thread.id, observedThreadConfiguration };
}

export function readTurnReceipt(value: Json) { return turnReceipt.parse(value).turn; }

export function startThreadRequest(profile: CodexExecutionProfileConfiguration, cwd: string): Json {
  return { model: profile.model, serviceTier: profile.serviceTier, cwd, ephemeral: profile.sessionPersistence !== 'host-owned',
    approvalPolicy: profile.approvalPolicy, sandbox: profile.sandboxMode };
}

export function resumeThreadRequest(profile: CodexExecutionProfileConfiguration, cwd: string, threadId: string): Json {
  return { threadId: nativeId.parse(threadId), model: profile.model, serviceTier: profile.serviceTier, cwd,
    approvalPolicy: profile.approvalPolicy, sandbox: profile.sandboxMode, excludeTurns: true };
}

export function startTurnRequest(profile: CodexExecutionProfileConfiguration, cwd: string, threadId: string, prompt: string): Json {
  return { threadId, model: profile.model, effort: profile.reasoningEffort, serviceTier: profile.serviceTier,
    serviceTierForTurn: profile.serviceTierForTurn, cwd, approvalPolicy: profile.approvalPolicy,
    sandboxPolicy: { type: 'readOnly', networkAccess: false }, input: [{ type: 'text', text: prompt, text_elements: [] }] };
}
