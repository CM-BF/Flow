import { codexExecutionProfileConfigurationSchema } from '../../../../../packages/contracts/src/execution-profiles.js';
import { configureCodexHarness, type CodexTransportFactory } from './index.js';
import { createCodexSessionStorage, type PersistentCodexTransportFactory } from './session-storage.js';
import { guardExecutionProfile, publishNativeExecutionProfile } from '../../execution-profiles.js';

/** JSON supplies only the public profile. Launch authority is an explicit trusted code dependency.
 * A fixed production recipe has not yet passed startup conformance, so there is no default factory. */
export function configureCodexLaunch(configuration: unknown, createTransport?: CodexTransportFactory) {
  const publicProfile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (!createTransport) throw new Error('A trusted Codex launch factory is unavailable.');
  return configureCodexHarness({ publicProfile, createTransport });
}

/** The operator owns this directory and factory; neither comes from task/profile JSON.
 * Publication must confirm the runner and configuration before storage can be bound.
 * Construction never launches a native process; the host retains directory ownership. */
export async function publishPersistentCodexLaunch(configuration: unknown, options: {
  baseUrl: string; token: string; signal?: AbortSignal;
  codeHome: string; createTransport: PersistentCodexTransportFactory;
}) {
  const { baseUrl, token, signal, codeHome, createTransport } = options;
  const publicProfile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (publicProfile.sessionPersistence !== 'host-owned') throw new Error('A persistent Codex profile is required.');
  if (typeof createTransport !== 'function') throw new Error('A trusted Codex launch factory is unavailable.');
  const reference = await publishNativeExecutionProfile({ baseUrl, token, signal, configuration: publicProfile });
  signal?.throwIfAborted();
  const sessionStorage = createCodexSessionStorage({ codeHome, runnerId: reference.runnerId,
    configDigest: reference.configDigest, createTransport });
  const configured = configureCodexHarness({ publicProfile, sessionStorage });
  return { reference: Object.freeze(reference), configured: { ...configured,
    adapter: guardExecutionProfile(configured.adapter, reference, publicProfile) } };
}
