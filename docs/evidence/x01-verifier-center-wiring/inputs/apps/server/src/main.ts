import { readPluginRuntimeConfiguration } from './plugin-runtime-configuration.js';
import { readPluginVerificationConfiguration } from './plugin-verification-configuration.js';
import { readPackageFetchConfiguration } from './package-fetch-configuration.js';
import { readPluginInstallationConfiguration } from './plugin-installation-configuration.js';
import { parseActiveSteeringConfiguration } from './active-steering-configuration.js';
import { createServer, type ServerOptions } from './index.js';

import { createStartupProgress, withStartupPhase } from './startup-progress.js';

const diagnosticEnabled = process.env.FLOW_STARTUP_DIAGNOSTICS === 'v1';
const startup = createStartupProgress({ enabled: diagnosticEnabled, write: frame => process.stderr.write(frame) });
const observer = diagnosticEnabled ? startup.observe : undefined;
startup.observe({ phase: 'main', event: 'point' });
try {
  const { port, options } = await withStartupPhase(observer, 'configuration', async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const ownerToken = process.env.FLOW_TOKEN;
    if (!databaseUrl || !ownerToken) throw new Error('DATABASE_URL and FLOW_TOKEN are required.');
    const port = Number(process.env.FLOW_PORT ?? 4310);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FLOW_PORT must be a valid port.');
    const packageFetchHost = await readPackageFetchConfiguration(process.env.FLOW_PACKAGE_FETCH_CONFIG);
    const pluginInstallHost = await readPluginInstallationConfiguration(process.env.FLOW_PLUGIN_INSTALL_CONFIG);
    const pluginRuntimeHostPolicy = await readPluginRuntimeConfiguration(process.env.FLOW_PLUGIN_RUNTIME_CONFIG);
    const pluginVerifierPolicy = await readPluginVerificationConfiguration(process.env.FLOW_PLUGIN_VERIFICATION_CONFIG);
    const activeSteering = parseActiveSteeringConfiguration(process.env.FLOW_ACTIVE_STEERING);
    // This is trusted host configuration, never a request parameter. Semantic validation lives in the auth module.
    const rawBrowserSession = process.env.FLOW_BROWSER_SESSION_JSON;
    let browserSession: ServerOptions['browserSession'];
    if (rawBrowserSession !== undefined) {
      if (!rawBrowserSession || Buffer.byteLength(rawBrowserSession) > 4096) throw new Error('FLOW_BROWSER_SESSION_JSON must be a nonempty JSON object of at most 4096 bytes.');
      try { browserSession = JSON.parse(rawBrowserSession) as ServerOptions['browserSession']; }
      catch { throw new Error('FLOW_BROWSER_SESSION_JSON must contain valid JSON.'); }
    }
    return { port, options: { databaseUrl, ownerToken, activeSteering, ...(pluginRuntimeHostPolicy ? { pluginRuntimeHostPolicy } : {}), ...(pluginVerifierPolicy ? { pluginVerifierPolicy } : {}), ...(browserSession !== undefined ? { browserSession } : {}), ...(packageFetchHost ? { packageFetchHost } : {}), ...(pluginInstallHost ? { pluginInstallHost } : {}), ...(process.env.FLOW_ORIGIN ? { allowedOrigin: process.env.FLOW_ORIGIN } : {}) } satisfies ServerOptions };
  });
  const app = await createServer({ ...options, ...(observer ? { startupObserver: observer } : {}) });
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
  try {
    await withStartupPhase(observer, 'listen', () => app.listen({ host: process.env.FLOW_HOST ?? '127.0.0.1', port }));
    startup.finish('listening');
  } catch (error) { startup.finish('failed'); await app.close(); throw error; }
} catch (error) { startup.finish('failed'); throw error; }
