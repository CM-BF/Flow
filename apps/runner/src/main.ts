import { loadRunnerAdapters } from './configuration.js';
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
    await runRunner({ ...common, adapters: await loadRunnerAdapters(process.env.FLOW_CLAUDE_MATERIALS_FILE) });
  }
} catch {
  process.stderr.write('Runner stopped: check its configuration, center authentication and local event storage.\n');
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}
