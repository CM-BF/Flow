import { loadEngineeringRunner } from './engineering/launch.js';
import { loadCodexProductionRunnerConfiguration, loadRunnerConfiguration } from './configuration.js';
import { parseRunnerConcurrency } from './concurrency-configuration.js';
import { guardExecutionProfile, publishExecutionProfile } from './execution-profiles.js';
import { runRunner, type RunnerNotice } from './runtime.js';
import { loadProtocolEndpoints, runProtocolRunner } from './protocol-dispatch/index.js';

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  const endpointsFile = process.env.FLOW_A2A_ENDPOINTS_FILE;
  const engineeringFile = process.env.FLOW_ENGINEERING_SETUP_FILE;
  const codexManifestFile = process.env.FLOW_CODEX_PROFILE_FILE;
  const launchManifestFile = process.env.FLOW_CODEX_LAUNCH_FILE;
  const codexSelected = codexManifestFile !== undefined || launchManifestFile !== undefined;
  if (codexSelected && (!codexManifestFile || !launchManifestFile || endpointsFile !== undefined || engineeringFile !== undefined
    || process.env.FLOW_CLAUDE_MATERIALS_FILE !== undefined)) throw new Error('Select one complete Codex host configuration.');
  const maxConcurrentAttempts = parseRunnerConcurrency(process.env.FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS, endpointsFile ? 'a2a' : 'native');
  const common = {
    baseUrl: process.env.FLOW_URL ?? 'http://127.0.0.1:4310',
    token: process.env.FLOW_RUNNER_TOKEN ?? '',
    workingDirectory: process.env.FLOW_RUNNER_WORKDIR ?? '',
    signal: shutdown.signal,
    onNotice: (notice: RunnerNotice | { type: 'protocol-uncertain'; attemptId?: string }) => {
      if (notice.type === 'runtime-initialized') {
        // Only the service parent creates this private channel; SDK output is not a readiness input.
        try { process.send?.({ protocol: 'flow.runner-startup.v1', type: notice.type, runnerId: notice.runnerId }, () => {}); } catch { /* Missing observation remains unknown to the parent. */ }
      } else process.stderr.write(`${JSON.stringify(notice)}\n`);
    },
  };
  if (codexSelected) {
    const loaded = await loadCodexProductionRunnerConfiguration({ ...common, codexManifestFile: codexManifestFile!, launchManifestFile: launchManifestFile! });
    await runRunner({ ...common, adapters: loaded.adapters, activeSteering: false, maxConcurrentAttempts });
  } else if (engineeringFile !== undefined) {
    if (endpointsFile !== undefined || process.env.FLOW_CLAUDE_MATERIALS_FILE !== undefined || maxConcurrentAttempts !== 1) throw new Error('Engineering setup requires its dedicated single-project host.');
    const adapter = await loadEngineeringRunner({ ...common, manifestFile: engineeringFile });
    await runRunner({ ...common, adapters: [adapter], maxConcurrentAttempts: 1 });
  } else if (endpointsFile) {
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
