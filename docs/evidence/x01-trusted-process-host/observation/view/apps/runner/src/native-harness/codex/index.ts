import { codexExecutionProfileConfigurationSchema, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { describeNativeHarness } from '../descriptor.js';
import { createCodexAdapter, type CodexTransportFactory } from './adapter.js';
import type { CodexSessionStorage } from './session-storage.js';

/** Configuration only. Construction never starts a process, reads a profile or probes a provider. */
export function configureCodexHarness(options: { publicProfile: CodexExecutionProfileConfiguration; createTransport?: CodexTransportFactory; sessionStorage?: CodexSessionStorage }) {
  const profile = codexExecutionProfileConfigurationSchema.parse(options.publicProfile);
  Object.freeze(profile.hostLimits); Object.freeze(profile);
  return describeNativeHarness(createCodexAdapter(profile, options.createTransport, options.sessionStorage), profile);
}
export type { CodexTransportFactory } from './adapter.js';
export { createCodexSessionStorage, type CodexSessionStorage, type PersistentCodexTransportFactory } from './session-storage.js';
