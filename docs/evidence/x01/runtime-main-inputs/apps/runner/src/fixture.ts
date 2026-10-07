import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { HarnessAdapter } from '@flow/contracts';
import { textDigest, verifyText } from './verifier.js';

export function createFixtureAdapter(): HarnessAdapter {
  return {
    name: 'fixture', version: '1',
    async run(context) {
      const sessionId = context.task.resumeSessionId ?? `fixture-${randomUUID()}`;
      await context.emit({ type: 'session', nativeSessionId: sessionId, adapterVersion: '1', resources: ['deterministic-test-adapter'] });
      await context.emit({ type: 'message', text: 'The deterministic test runner is preparing a verified artifact.' });
      await context.assertOwnership();
      const delayMs = context.task.fixture?.delayMs ?? (context.task.fixture?.scenario === 'slow' ? 8000 : 600);
      await sleep(delayMs, undefined, { signal: context.signal });
      if (context.task.fixture?.scenario === 'failure') throw new Error('The deterministic failure fixture stopped execution.');
      if (context.task.fixture?.scenario === 'decision') {
        const answer = await context.waitForDecision({ id: randomUUID(), prompt: 'Publish the prepared test artifact?' });
        if (answer === 'reject') throw new Error('Artifact publication was rejected.');
      }
      if (context.task.fixture?.scenario === 'large') {
        await context.emit({ type: 'detail', title: 'Large fixture evidence', content: 'x'.repeat(context.task.fixture.detailBytes ?? 262_144), mediaType: 'text/plain' });
      }
      const artifactId = randomUUID();
      const file = join(context.workingDirectory, 'artifact.txt');
      const result = context.task.fixture?.scenario === 'verification-failure' ? '' : `Flow fixture result\n${context.task.prompt}\n`;
      await context.assertOwnership();
      await writeFile(file, result, { mode: 0o600 });
      const content = await readFile(file, 'utf8');
      await context.emit({ type: 'artifact', artifactId, title: 'Fixture result', version: textDigest(content), content, mediaType: 'text/plain' });
      await context.emit(verifyText(artifactId, content, context.task.verification));
      await context.emit({ type: 'usage', source: 'fixture', scope: 'session', scopeId: sessionId, model: 'deterministic', sampleId: randomUUID(), cumulative: true, baseline: { kind: context.task.resumeSessionId ? 'unknown' : 'new-session' }, accounting: 'authoritative', costKind: 'unknown', inputTokens: 0, outputTokens: 0, costUsd: null });
    },
  };
}
