import type { CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { codexAssistantFinalDataSchema } from '../../../../../packages/contracts/src/assistant.js';
import { NativeExecutionError } from '../settlement.js';
import { OrdinaryTurnEvidence } from './evidence.js';
import { denyCodexRequest } from './policy.js';
import { readThreadReceipt, startThreadRequest, startTurnRequest } from './wire.js';
import { runCodexExchange, type CodexTransportFactory, type CodexExchangeInput } from './exchange.js';
export type { CodexTransportFactory } from './exchange.js';

export interface OrdinaryCodexTurnInput extends CodexExchangeInput { readonly prompt: string }
/** Runs one ordinary turn without host events, persistence or admission authority. */
export async function runOrdinaryCodexTurn(profile: CodexExecutionProfileConfiguration, createTransport: CodexTransportFactory, input: OrdinaryCodexTurnInput) {
  const { thread, observation } = await runCodexExchange(createTransport, input, profile.hostLimits, {
    evidence: new OrdinaryTurnEvidence(), startThread: startThreadRequest(profile, input.workingDirectory),
    startTurn: threadId => startTurnRequest(profile, input.workingDirectory, threadId, input.prompt),
    readThread: readThreadReceipt, checkCompletion() {}, respond: method => ({ allowed: false, reply: denyCodexRequest(method) }),
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
