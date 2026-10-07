import type { CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { codexAssistantFinalDataSchema } from '../../../../../packages/contracts/src/assistant.js';
import { NativeExecutionError } from '../settlement.js';
import { OrdinaryTurnEvidence, type CodexStreamDelta } from './evidence.js';
import { denyCodexRequest } from './policy.js';
import { readThreadReceipt, resumeThreadRequest, startThreadRequest, startTurnRequest } from './wire.js';
import { runCodexExchange, type CodexTransportFactory, type CodexExchangeInput, type CodexStreamFlush } from './exchange.js';
export type { CodexTransportFactory } from './exchange.js';

export interface OrdinaryCodexTurnInput extends CodexExchangeInput { readonly prompt: string; readonly resumeSessionId?: string; readonly streamFlush?: CodexStreamFlush; onStream?(delta: CodexStreamDelta, signal: AbortSignal): Promise<void>; onStreamComplete?(delta: CodexStreamDelta, signal: AbortSignal): Promise<void> }
/** Runs one ordinary turn without host events, persistence or admission authority. */
export async function runOrdinaryCodexTurn(profile: CodexExecutionProfileConfiguration, createTransport: CodexTransportFactory, input: OrdinaryCodexTurnInput) {
  const resumedId = input.resumeSessionId;
  if (resumedId !== undefined && profile.sessionPersistence !== 'host-owned') throw new NativeExecutionError('settled');
  const { thread, observation } = await runCodexExchange(createTransport, input, profile.hostLimits, {
    evidence: new OrdinaryTurnEvidence(), onStream: input.onStream, onStreamComplete: input.onStreamComplete, streamFlush: input.streamFlush,
    threadMethod: resumedId === undefined ? 'thread/start' : 'thread/resume',
    startThread: resumedId === undefined ? startThreadRequest(profile, input.workingDirectory) : resumeThreadRequest(profile, input.workingDirectory, resumedId),
    startTurn: threadId => startTurnRequest(profile, input.workingDirectory, threadId, input.prompt),
    readThread(response) {
      const receipt = readThreadReceipt(response);
      if (resumedId !== undefined && receipt.threadId !== resumedId) throw new NativeExecutionError('unknown');
      return receipt;
    },
    checkCompletion() {}, respond: method => ({ allowed: false, reply: denyCodexRequest(method) }),
  });
  try {
    const { model, reasoningEffort, serviceTier, serviceTierForTurn, access } = profile;
    return codexAssistantFinalDataSchema.parse({
      type: 'assistant-final', source: observation.final.source, messageId: observation.final.messageId,
      nativeSessionId: observation.final.nativeSessionId, sourceMessageId: observation.final.sourceMessageId,
      nativeSourceIdentity: { turnId: observation.final.nativeTurnId, itemId: observation.final.nativeItemId }, content: observation.final.text,
      settings: { requested: { model, reasoningEffort, serviceTier, serviceTierForTurn, access }, observedThreadConfiguration: thread.observedThreadConfiguration,
        actualExecution: { model: null, reasoningEffort: null, serviceTier: null, tools: null, evidence: 'unknown' } },
    });
  } catch { throw new NativeExecutionError('unknown'); }
}
