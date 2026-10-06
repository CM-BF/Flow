import { loadRunnerConfiguration } from './configuration.js';
import { parseRunnerConcurrency } from './concurrency-configuration.js';
import { guardExecutionProfile, publishExecutionProfile } from './execution-profiles.js';
import { runRunner } from './runtime.js';
import { loadProtocolEndpoints, runProtocolRunner } from './protocol-dispatch/index.js';

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  const endpointsFile = process.env.FLOW_A2A_ENDPOINTS_FILE;
  const maxConcurrentAttempts = parseRunnerConcurrency(process.env.FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS, endpointsFile ? 'a2a' : 'native');
  const common = {
    baseUrl: process.env.FLOW_URL ?? 'http://127.0.0.1:4310',
    token: process.env.FLOW_RUNNER_TOKEN ?? '',
    workingDirectory: process.env.FLOW_RUNNER_WORKDIR ?? '',
    signal: shutdown.signal,
    onNotice: (notice: unknown) => process.stderr.write(`${JSON.stringify(notice)}\n`),
  };
  if (endpointsFile) {
    await runProtocolRunner({ ...common, endpoints: await loadProtocolEndpoints(endpointsFile) });
  } else {
    const loaded = await loadRunnerConfiguration(process.env.FLOW_CLAUDE_MATERIALS_FILE);
    const profile = loaded.profile;
    const reference = profile ? await publishExecutionProfile({ ...common, configuration: profile }) : null;
    const adapters = loaded.harnesses.map(({ adapter, descriptor }) => descriptor.publicProfile && reference
      ? guardExecutionProfile(adapter, reference, descriptor.publicProfile) : adapter);
    await runRunner({ ...common, adapters, activeSteering: loaded.activeSteering, maxConcurrentAttempts });
  }
} catch {
  process.stderr.write('Runner stopped: check its configuration, center authentication and local event storage.\n');
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}
