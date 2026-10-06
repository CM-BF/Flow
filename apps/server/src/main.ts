import { readPackageFetchConfiguration } from './package-fetch-configuration.js';
import { parseActiveSteeringConfiguration } from './active-steering-configuration.js';
import { createServer } from './index.js';

const databaseUrl = process.env.DATABASE_URL;
const ownerToken = process.env.FLOW_TOKEN;
if (!databaseUrl || !ownerToken) throw new Error('DATABASE_URL and FLOW_TOKEN are required.');
const port = Number(process.env.FLOW_PORT ?? 4310);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FLOW_PORT must be a valid port.');
const packageFetchHost = await readPackageFetchConfiguration(process.env.FLOW_PACKAGE_FETCH_CONFIG);
const activeSteering = parseActiveSteeringConfiguration(process.env.FLOW_ACTIVE_STEERING);
const app = await createServer({ databaseUrl, ownerToken, activeSteering, ...(packageFetchHost ? { packageFetchHost } : {}), ...(process.env.FLOW_ORIGIN ? { allowedOrigin: process.env.FLOW_ORIGIN } : {}) });
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  // A stalled handler/database cleanup must not hang an operator's stop indefinitely.
  // This last resort is abnormal termination, never proof that outstanding work stopped or committed.
  const deadline = setTimeout(() => {
    process.stderr.write('Center shutdown: cleanup deadline exceeded; forced process exit, unacknowledged outcomes unknown.\n');
    process.exit(1);
  }, 20_000);
  deadline.unref();
  void app.close().then(() => {
    clearTimeout(deadline);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }, () => {
    process.stderr.write('Center shutdown: resource cleanup failed; unacknowledged outcomes unknown.\n');
    process.exitCode = 1;
    // Keep the final deadline if a failed cleanup left a referenced resource behind.
  });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try { await app.listen({ host: process.env.FLOW_HOST ?? '127.0.0.1', port }); }
catch (error) { await app.close(); throw error; }
