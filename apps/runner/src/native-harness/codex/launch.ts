import { codexExecutionProfileConfigurationSchema } from '../../../../../packages/contracts/src/execution-profiles.js';
import { configureCodexHarness, type CodexTransportFactory } from './index.js';

/** JSON supplies only the public profile. Launch authority is an explicit trusted code dependency.
 * A fixed production recipe has not yet passed startup conformance, so there is no default factory. */
export function configureCodexLaunch(configuration: unknown, createTransport?: CodexTransportFactory) {
  const publicProfile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (!createTransport) throw new Error('A trusted Codex launch factory is unavailable.');
  return configureCodexHarness({ publicProfile, createTransport });
}
