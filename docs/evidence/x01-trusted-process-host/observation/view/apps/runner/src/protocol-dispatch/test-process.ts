// Deterministic integration entry point: real process, public runtime, no model/provider calls.
import { runProtocolRunner, loadProtocolEndpoints } from './index.js';
const stop = new AbortController();
process.on('SIGTERM', () => stop.abort()); process.on('SIGINT', () => stop.abort());
await runProtocolRunner({ baseUrl: process.env.FLOW_URL!, token: process.env.FLOW_RUNNER_TOKEN!, workingDirectory: process.env.FLOW_RUNNER_WORKDIR!,
  endpoints: await loadProtocolEndpoints(process.env.FLOW_A2A_ENDPOINTS_FILE!), signal: stop.signal,
  pollIntervalMs: 40, heartbeatIntervalMs: 100, requestTimeoutMs: 1000 });
