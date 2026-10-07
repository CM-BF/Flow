import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { HarnessAdapter, HarnessContext } from '@flow/contracts';
import { executionProfileReferenceSchema, type ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { nativeEngineeringIntentSchema, nativeEngineeringProfileConfigurationSchema, nativeEngineeringProfileConfigurationJson,
  nativeEngineeringReceiptSchema, nativeEngineeringReceiptJson, nativeEngineeringVerificationInput,
  type NativeEngineeringProfileConfiguration, type NativeEngineeringReceipt } from '../../../../packages/contracts/src/engineering-native.js';
import { NativeExecutionError } from '../native-harness/settlement.js';
import { captureCalculatorWorkspace } from './calculator-capture.js';
import { calculatorExecutionIdentitySchema } from './calculator-receipt.js';
import { createCodexEngineeringWriter, type NativeWriteAuthority, type NativeWriteBinding } from './native-writer.js';
import { executeEngineeringWriter } from './writer.js';
import { digest } from './resources.js';
import type { EngineeringWorkspace, SyntheticProject } from './workspace.js';

export interface NativeEngineeringSetup {
  project: SyntheticProject;
  configuration: NativeEngineeringProfileConfiguration;
  reference: ExecutionProfileReference;
  authority: NativeWriteAuthority;
}

/** Trusted host composition only: no profile publication, concrete authority or production registration. */
export function createNativeEngineeringAdapter(setup: NativeEngineeringSetup): HarnessAdapter {
  const configuration = nativeEngineeringProfileConfigurationSchema.parse(setup.configuration);
  const reference = executionProfileReferenceSchema.parse(setup.reference);
  const { project, authority } = setup;
  if (!authority || typeof authority.open !== 'function' || typeof authority.close !== 'function'
    || reference.configDigest !== digest(nativeEngineeringProfileConfigurationJson(configuration))
    || project.id !== configuration.project.id || project.baseCommit !== configuration.project.baseCommit) throw Error('Native engineering setup differs.');
  // The existing synthetic project permits at most eight retained worktrees. Never keep an unbounded attempt registry.
  const invoked = new Set<string>();
  return { name: 'codex', version: 'engineering-codex-1', async run(context) {
    const identity = calculatorExecutionIdentitySchema.safeParse(context.executionIdentity);
    const parsed = nativeEngineeringIntentSchema.safeParse(context.task.engineering);
    if (!identity.success || !parsed.success || context.task.harness !== 'codex'
      || identity.data.runnerId !== reference.runnerId || parsed.data.targetRunnerId !== reference.runnerId
      || parsed.data.projectId !== project.id || parsed.data.baseCommit !== project.baseCommit
      || !isDeepStrictEqual(parsed.data.profile, reference) || !isDeepStrictEqual(parsed.data.checker, configuration.checker)) throw new NativeExecutionError('settled');
    const intent = parsed.data, key = JSON.stringify(identity.data);
    if (invoked.has(key) || invoked.size >= 8) throw new NativeExecutionError('unknown');
    await ownership(context);
    invoked.add(key);
    let workspace: EngineeringWorkspace;
    try { workspace = await project.acquire(); }
    catch { throw new NativeExecutionError('unknown'); }
    let release = false;
    try {
      await ownership(context);
      const observed = observeAuthority(authority);
      const writer = createCodexEngineeringWriter({ ...context, executionIdentity: identity.data }, configuration.model, observed.authority, configuration.limits.writerTimeoutMs);
      const written = await executeEngineeringWriter(writer.execute, { directory: workspace.directory, leaseId: workspace.leaseId,
        baseCommit: project.baseCommit, prompt: context.task.prompt, signal: context.signal, assertOwnership: () => context.assertOwnership() });
      const revoked = observed.revoked();
      if (written.settlement !== 'stopped' || !revoked || revoked.leaseId !== workspace.leaseId
        || revoked.baseCommit !== intent.baseCommit || revoked.directory !== workspace.directory
        || revoked.model !== configuration.model || !isDeepStrictEqual(revoked.identity, identity.data)) throw new NativeExecutionError('unknown');
      await ownership(context);
      if (written.outcome === 'failed') { release = true; throw new NativeExecutionError('settled'); }
      const captured = await captureCalculatorWorkspace(workspace, { ...context, executionIdentity: identity.data });
      if (captured.state !== 'recorded') throw new NativeExecutionError('unknown');
      const receipt = nativeEngineeringReceiptSchema.parse({ protocol: 'flow.engineering.native-receipt.v1', intent, check: captured.receipt,
        writer: { identity: revoked.identity, leaseId: revoked.leaseId, baseCommit: revoked.baseCommit, profile: reference,
          ...configuration.authority, model: revoked.model, writeAccess: 'revoked' }, result: captured.receipt.report.result === 'passed' ? 'passed' : 'failed' });
      await publish(context, receipt);
      await ownership(context);
      release = true;
      if (receipt.result !== 'passed') throw new NativeExecutionError('settled');
    } catch (error) {
      if (!release) throw new NativeExecutionError('unknown');
      throw error;
    } finally {
      if (release) { try { await workspace.release(); } catch { throw new NativeExecutionError('unknown'); } }
    }
  } };
}

async function ownership(context: HarnessContext) {
  context.signal.throwIfAborted(); await context.assertOwnership(); context.signal.throwIfAborted();
}

/** Copies evidence from this authority's real call, not a serialized caller-provided stopped flag. */
function observeAuthority(authority: NativeWriteAuthority) {
  let opened: NativeWriteBinding | undefined, revoked: NativeWriteBinding | undefined;
  return { revoked: () => revoked, authority: {
    async open(binding, signal) { opened = structuredClone(binding); return authority.open(binding, signal); },
    async close(binding, signal) {
      const result = await authority.close(binding, signal);
      if (result.writeAccess === 'revoked' && isDeepStrictEqual(opened, binding) && isDeepStrictEqual(result.binding, binding)) revoked = structuredClone(binding);
      return result;
    },
  } satisfies NativeWriteAuthority };
}

async function publish(context: HarnessContext, receipt: NativeEngineeringReceipt) {
  const content = nativeEngineeringReceiptJson(receipt), artifactId = randomUUID(), version = digest(content);
  await ownership(context);
  await context.emit({ type: 'artifact', artifactId, title: 'Native engineering workspace and checker receipt', version, content, mediaType: 'application/json' });
  await ownership(context);
  await context.emit({ type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.engineering.native', verifierVersion: '1',
    inputDigest: digest(nativeEngineeringVerificationInput(version, receipt.intent)), result: receipt.result,
    evidence: receipt.result === 'passed' ? 'The host checked the complete unchanged content set after its authority reported write revocation.' : 'The host calculator check failed or rejected the complete content set.' });
}
