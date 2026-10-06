import type { HarnessName } from './harnesses.js';
import type { HarnessAdapter } from './runner.js';
import type { ExecutionProfileConfiguration } from './execution-profiles.js';

/** Local configuration description, never a grant or a provider capability attestation.
 * Missing ports are unavailable. Version 1 preserves HarnessAdapter.run(): Promise<void>.
 * This description is not sent to the center and does not change profile digest bytes. */
export interface NativeHarnessDescriptor {
  protocol: 'flow.native-harness.v1';
  harness: HarnessName;
  adapterVersion: string;
  ports: {
    steering?: 'flow.active-steering.v1';
    goalTools?: 1;
    goalGraphTools?: 1;
  };
  publicProfile: ExecutionProfileConfiguration | null;
}

/** Created only from a trusted local configuration factory, not an HTTP payload. */
export interface ConfiguredNativeHarness {
  adapter: HarnessAdapter;
  descriptor: NativeHarnessDescriptor;
}
