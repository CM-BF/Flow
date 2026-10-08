import { randomUUID } from 'node:crypto';
import type { HarnessAdapter } from '@flow/contracts';
import { engineeringReceiptJson, engineeringReceiptResult, engineeringVerificationInput, type EngineeringReceipt } from '../../../../packages/contracts/src/engineering.js';
import { NativeExecutionError } from '../native-harness/settlement.js';
import type { TrustedChecker } from './checker.js';
import type { SyntheticProject } from './workspace.js';
import { executeEngineeringWriter, type EngineeringWriter } from './writer.js';
import { digest } from './resources.js';

export interface EngineeringFixture extends EngineeringWriter {
  project: SyntheticProject;
  checker: TrustedChecker;
}

/** A dedicated fixture host composes this adapter; the existing runtime owns claim, lease, journal, outbox and terminal events. */
export function createEngineeringFixtureAdapter(runnerId: string, fixtures: EngineeringFixture[]): HarnessAdapter {
  const registry = new Map(fixtures.map(fixture => [fixture.project.id, fixture]));
  if (registry.size !== fixtures.length) throw new Error('Duplicate engineering project registration.');
  return { name: 'fixture', version: 'engineering-1', async run(context) {
    const intent = context.task.engineering, fixture = intent ? registry.get(intent.projectId) : undefined;
    if (!intent || intent.protocol !== 'flow.engineering.v1' || !fixture || runnerId !== intent.targetRunnerId || fixture.project.baseCommit !== intent.baseCommit
      || JSON.stringify(fixture.checker.selection) !== JSON.stringify(intent.checker)) throw new NativeExecutionError('settled');
    await context.assertOwnership();
    const workspace = await fixture.project.acquire(); let unknown = false;
    try {
      await context.assertOwnership(); context.signal.throwIfAborted();
      unknown = true;
      const written = await executeEngineeringWriter(fixture.execute, {
        directory: workspace.directory, leaseId: workspace.leaseId, baseCommit: fixture.project.baseCommit,
        prompt: context.task.prompt, signal: context.signal, assertOwnership: () => context.assertOwnership(),
      });
      if (written.settlement === 'unknown') throw new NativeExecutionError('unknown');
      unknown = false;
      if (written.outcome === 'failed') throw new NativeExecutionError('settled');
      await context.assertOwnership(); context.signal.throwIfAborted();
      const before = await workspace.snapshot();
      const checked = await fixture.checker.run(workspace.directory, context.signal);
      unknown = !checked.command.childExited;
      const after = await workspace.snapshot();
      const receipt: EngineeringReceipt = { protocol: 'flow.engineering.receipt.v1', intent,
        workspace: { leaseId: workspace.leaseId, baseCommit: before.baseCommit, headCommit: before.headCommit, beforeDigest: before.digest, afterDigest: after.digest, files: before.files },
        ...checked, diff: { content: before.diff, digest: digest(before.diff) }, result: 'unknown' };
      receipt.result = engineeringReceiptResult(receipt);
      const content = engineeringReceiptJson(receipt), artifactId = randomUUID(), version = digest(content);
      await context.assertOwnership();
      await context.emit({ type: 'artifact', artifactId, title: 'Engineering workspace and checker receipt', version, content, mediaType: 'application/json' });
      if (receipt.result === 'unknown') throw new NativeExecutionError('unknown');
      await context.emit({ type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.engineering', verifierVersion: '1',
        inputDigest: digest(engineeringVerificationInput(version, intent)), result: receipt.result,
        evidence: receipt.result === 'passed' ? 'The trusted host checker passed every fixed case against the unchanged content set.' : 'The host checker did not satisfy the fixed baseline and content-set requirements.' });
      if (receipt.result !== 'passed') throw new NativeExecutionError('settled');
    } catch (error) {
      if (error instanceof NativeExecutionError && error.settlement === 'unknown') unknown = true;
      if (unknown) throw new NativeExecutionError('unknown');
      throw error;
    } finally { if (!unknown) await workspace.release(); }
  } };
}
