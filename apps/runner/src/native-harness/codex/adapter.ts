import type { HarnessAdapter, RunnerEventData } from '@flow/contracts';
import { codexExecutionProfileConfigurationSchema, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { textDigest, verifyText } from '../../verifier.js';
import { NativeExecutionError } from '../settlement.js';
import { runOrdinaryCodexTurn, type CodexTransportFactory } from './turn.js';

export type { CodexTransportFactory } from './turn.js';

export function createCodexAdapter(configuration: CodexExecutionProfileConfiguration, createTransport: CodexTransportFactory): HarnessAdapter {
  const profile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (typeof createTransport !== 'function') throw new Error('An explicit native transport factory is required.');
  return { name: profile.harness, version: profile.adapterVersion, async run(context) {
    if (context.task.harness !== 'codex' || !context.task.executionProfile || context.task.resumeSessionId || context.task.fixture || context.task.protocol
      || context.steering || context.goalTools || context.goalGraphTools) throw new NativeExecutionError('settled');
    await context.assertOwnership(); context.signal.throwIfAborted();
    const final = await runOrdinaryCodexTurn(profile, createTransport, {
      prompt: context.task.prompt, workingDirectory: context.workingDirectory, signal: context.signal, assertOwnership: () => context.assertOwnership(),
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
