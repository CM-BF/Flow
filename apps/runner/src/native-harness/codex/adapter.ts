import type { HarnessAdapter, RunnerEventData } from '@flow/contracts';
import { codexExecutionProfileConfigurationSchema, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { textDigest, verifyText } from '../../verifier.js';
import { NativeExecutionError } from '../settlement.js';
import { runOrdinaryCodexTurn, type CodexTransportFactory } from './turn.js';
import { assertCodexSessionStorage, sessionTransport, type CodexSessionStorage } from './session-storage.js';

export type { CodexTransportFactory } from './turn.js';

export function createCodexAdapter(configuration: CodexExecutionProfileConfiguration, createTransport?: CodexTransportFactory, sessionStorage?: CodexSessionStorage): HarnessAdapter {
  const profile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (profile.sessionPersistence) {
    assertCodexSessionStorage(sessionStorage, profile);
    if (createTransport !== undefined) throw new Error('Persistent transports must be bound by their host-owned storage.');
  } else if (typeof createTransport !== 'function' || sessionStorage !== undefined) throw new Error('An explicit native transport factory is required.');
  return { name: profile.harness, version: profile.adapterVersion, async run(context) {
    if (context.task.harness !== 'codex' || !context.task.executionProfile || context.task.engineering
      || (context.task.resumeSessionId !== undefined && !profile.sessionPersistence) || context.task.fixture || context.task.protocol
      || context.steering || context.goalTools || context.goalGraphTools) throw new NativeExecutionError('settled');
    await context.assertOwnership(); context.signal.throwIfAborted();
    const factory = profile.sessionPersistence ? sessionTransport(sessionStorage!, profile, context) : createTransport!;
    const final = await runOrdinaryCodexTurn(profile, factory, {
      prompt: context.task.prompt, workingDirectory: context.workingDirectory, signal: context.signal, assertOwnership: () => context.assertOwnership(),
      ...(context.task.resumeSessionId !== undefined ? { resumeSessionId: context.task.resumeSessionId } : {}),
    });
    const artifactId = `codex-${final.messageId}`;
    const events: RunnerEventData[] = [
      { type: 'session', nativeSessionId: final.nativeSessionId, adapterVersion: profile.adapterVersion }, final,
      { type: 'artifact', artifactId, title: 'Native final', version: textDigest(final.content), content: final.content, mediaType: 'text/plain' },
      verifyText(artifactId, final.content, context.task.verification),
    ];
    for (const event of events) { await context.assertOwnership(); await context.emit(event); }
  } };
}
