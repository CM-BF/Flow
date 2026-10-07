import type { HarnessAdapter } from '@flow/contracts';
import type { ConfiguredNativeHarness } from '../../../../packages/contracts/src/native-harness.js';
import type { NativeExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';

/** Local factories supply the adapter and its already validated public profile. */
export function describeNativeHarness<Profile extends NativeExecutionProfileConfiguration | null>(adapter: HarnessAdapter, publicProfile: Profile): ConfiguredNativeHarness<Profile> {
  return {
    adapter,
    descriptor: {
      protocol: 'flow.native-harness.v1', harness: adapter.name, adapterVersion: adapter.version,
      ports: {
        ...(publicProfile?.harness === 'claude' && publicProfile.activeSteering ? { steering: publicProfile.activeSteering.protocol } : {}),
        ...(publicProfile?.access === 'goal-tools' ? { goalTools: 1 as const } : {}),
        ...(publicProfile?.access === 'goal-graph-tools' ? { goalGraphTools: 1 as const } : {}),
        ...(publicProfile?.harness === 'codex' && publicProfile.sessionPersistence ? { sessionPersistence: publicProfile.sessionPersistence } : {}),
      },
      publicProfile,
    },
  };
}
