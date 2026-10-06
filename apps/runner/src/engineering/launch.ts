import { FlowClient } from '@flow/client';
import type { HarnessAdapter } from '@flow/contracts';
import { engineeringProfileConfigurationJson } from '../../../../packages/contracts/src/engineering-profile.js';
import { digest } from './resources.js';
import { prepareEngineeringSetup } from './setup.js';

/** Composes trusted setup and shared HTTP publication. The existing runtime remains the sole execution host. */
export async function loadEngineeringRunner(options: {
  baseUrl: string; token: string; workingDirectory: string; manifestFile: string; signal?: AbortSignal;
}): Promise<HarnessAdapter> {
  options.signal?.throwIfAborted();
  const setup = await prepareEngineeringSetup(options.workingDirectory, options.manifestFile);
  options.signal?.throwIfAborted();
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
  const publication = await new FlowClient(options).publishEngineeringProfile({ configuration: setup.configuration }, signal);
  const canonical = engineeringProfileConfigurationJson(setup.configuration);
  if (engineeringProfileConfigurationJson(publication.profile.configuration) !== canonical || publication.profile.reference.configDigest !== digest(canonical)) {
    throw new Error('The center did not confirm the engineering setup.');
  }
  options.signal?.throwIfAborted();
  return setup.bind(publication.profile.reference);
}
