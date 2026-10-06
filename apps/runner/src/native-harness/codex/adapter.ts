import type { HarnessAdapter, HarnessContext, RunnerEventData } from '@flow/contracts';
import { codexExecutionProfileConfigurationSchema, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { codexAssistantFinalDataSchema } from '../../../../../packages/contracts/src/assistant.js';
import { CodexTransportError, type CodexTransport } from '../../codex/types.js';
import { textDigest, verifyText } from '../../verifier.js';
import { NativeExecutionError } from '../settlement.js';
import { OrdinaryTurnEvidence } from './evidence.js';
import { denyCodexRequest } from './policy.js';
import { readThreadReceipt, readTurnReceipt, startThreadRequest, startTurnRequest } from './wire.js';

/** No default executable or ambient environment. The trusted caller owns process policy. */
export type CodexTransportFactory = (options: { signal: AbortSignal; workingDirectory: string }) => CodexTransport;

export function createCodexAdapter(configuration: CodexExecutionProfileConfiguration, createTransport: CodexTransportFactory): HarnessAdapter {
  const profile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (typeof createTransport !== 'function') throw new Error('An explicit native transport factory is required.');
  return { name: profile.harness, version: profile.adapterVersion, async run(context) {
    if (context.task.harness !== 'codex' || !context.task.executionProfile || context.task.resumeSessionId || context.task.fixture || context.task.protocol
      || context.steering || context.goalTools || context.goalGraphTools) throw new NativeExecutionError('settled');
    await context.assertOwnership(); context.signal.throwIfAborted();
    const final = await collectFinal(profile, createTransport, context);
    const artifactId = `codex-${final.messageId}`;
    const events: RunnerEventData[] = [
      { type: 'session', nativeSessionId: final.nativeSessionId, adapterVersion: profile.adapterVersion }, final,
      { type: 'artifact', artifactId, title: 'Native final', version: textDigest(final.content), content: final.content, mediaType: 'text/plain' },
      verifyText(artifactId, final.content, context.task.verification),
    ];
    for (const event of events) { await context.assertOwnership(); await context.emit(event); }
  } };
}

async function collectFinal(profile: CodexExecutionProfileConfiguration, createTransport: CodexTransportFactory, context: HarnessContext) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), profile.hostLimits.wallTimeMs);
  const signal = AbortSignal.any([context.signal, deadline.signal]);
  const evidence = new OrdinaryTurnEvidence();
  let transport: CodexTransport | undefined, pump: Promise<void> | undefined;
  let dispatched = false, violated = false, pumpFailed = false;
  let wake!: () => void;
  const terminal = new Promise<void>(resolve => { wake = resolve; });
  function checkTerminal() { if (evidence.observation.state !== 'pending') wake(); }
  try {
    transport = createTransport({ signal, workingDirectory: context.workingDirectory });
    await transport.ready;
    const connected = transport;
    // Exactly one R06 consumer. No SDK loop, request retries, durable state or lifecycle events here.
    pump = (async () => {
      try {
        for (let message = await connected.receive(); message !== null; message = await connected.receive()) {
          if (message.kind === 'server-request') {
            violated = true;
            await connected.respond(message.id, denyCodexRequest(message.method));
            wake();
          } else { evidence.accept(message); checkTerminal(); }
        }
      } catch { pumpFailed = true; } // Discard AssertionError actual/expected and every raw native payload.
      finally { wake(); }
    })();
    dispatched = true;
    let response;
    try { response = await connected.request('thread/start', startThreadRequest(profile, context.workingDirectory), { signal }); }
    catch (error) { if (error instanceof CodexTransportError && error.delivery === 'not-sent') dispatched = false; throw error; }
    const thread = readThreadReceipt(response);
    evidence.bindThread(thread.threadId);
    if (violated || pumpFailed) throw new Error('Native evidence rejected.');
    await context.assertOwnership(); signal.throwIfAborted();
    const started = await connected.request('turn/start', startTurnRequest(profile, context.workingDirectory, thread.threadId, context.task.prompt), { signal });
    evidence.bindTurn(readTurnReceipt(started)); checkTerminal();
    await terminal;
    const close = await connected.close();
    await pump;
    if (violated || pumpFailed || close.child !== 'confirmed-exited' || close.reason !== 'CLOSED') throw new NativeExecutionError('unknown');
    const observation = evidence.observation;
    if (observation.state !== 'completed') throw new NativeExecutionError(observation.state === 'failed' || observation.state === 'interrupted' ? 'settled' : 'unknown');
    if (Buffer.byteLength(observation.final.text) > profile.hostLimits.maxOutputBytes) throw new NativeExecutionError('settled');
    signal.throwIfAborted();
    const { model, reasoningEffort, serviceTier, serviceTierForTurn, access } = profile;
    return codexAssistantFinalDataSchema.parse({
      type: 'assistant-final', source: observation.final.source, messageId: observation.final.messageId,
      nativeSessionId: observation.final.nativeSessionId, sourceMessageId: observation.final.sourceMessageId,
      nativeSourceIdentity: { turnId: observation.final.nativeTurnId, itemId: observation.final.nativeItemId }, content: observation.final.text,
      settings: { requested: { model, reasoningEffort, serviceTier, serviceTierForTurn, access }, observedThreadConfiguration: thread.observedThreadConfiguration,
        actualExecution: { model: null, reasoningEffort: null, serviceTier: null, tools: null, evidence: 'unknown' } },
    });
  } catch (error) {
    if (error instanceof NativeExecutionError) throw error;
    throw new NativeExecutionError(dispatched ? 'unknown' : 'settled');
  } finally {
    clearTimeout(timer);
    let childConfirmed = true;
    if (transport) {
      try { childConfirmed = (await transport.close()).child === 'confirmed-exited'; }
      catch { childConfirmed = false; }
    }
    await pump;
    if (!childConfirmed) throw new NativeExecutionError('unknown');
  }
}
