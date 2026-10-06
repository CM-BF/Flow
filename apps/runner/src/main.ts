import { loadRunnerConfiguration } from './configuration.js';
import { guardExecutionProfile, publishExecutionProfile } from './execution-profiles.js';
import { runRunner } from './runtime.js';
import { loadProtocolEndpoints, runProtocolRunner } from './protocol-dispatch/index.js';

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  const common = {
    baseUrl: process.env.FLOW_URL ?? 'http://127.0.0.1:4310',
    token: process.env.FLOW_RUNNER_TOKEN ?? '',
    workingDirectory: process.env.FLOW_RUNNER_WORKDIR ?? '',
    signal: shutdown.signal,
    onNotice: (notice: unknown) => process.stderr.write(`${JSON.stringify(notice)}\n`),
  };
  if (process.env.FLOW_A2A_ENDPOINTS_FILE) {
    await runProtocolRunner({ ...common, endpoints: await loadProtocolEndpoints(process.env.FLOW_A2A_ENDPOINTS_FILE) });
  } else {
    const loaded = await loadRunnerConfiguration(process.env.FLOW_CLAUDE_MATERIALS_FILE);
    const profile = loaded.profile;
    const reference = profile ? await publishExecutionProfile({ ...common, configuration: profile }) : null;
    const adapters = loaded.adapters.map(adapter => profile && reference && adapter.name === profile.harness
      ? guardExecutionProfile(adapter, reference, profile) : adapter);
    await runRunner({ ...common, adapters, activeSteering: loaded.activeSteering });
  }
} catch {
  process.stderr.write('Runner stopped: check its configuration, center authentication and local event storage.\n');
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}
