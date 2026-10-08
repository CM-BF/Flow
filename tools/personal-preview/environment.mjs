import { join } from 'node:path';
import { normalizeBrowserSessionSettings, browserCompatibilityContext } from './browser-session-configuration.mjs';

const systemKeys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ'];
const providerKeys = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR', 'ANTHROPIC_BASE_URL',
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];

/** Only runner receives provider authentication; no inherited application credentials cross this boundary. */
export function baseServiceEnvironment(role, inherited = process.env) {
  if (!['center', 'runner', 'web'].includes(role)) throw new Error('Unknown preview service.');
  const keys = role === 'runner' ? [...systemKeys, ...providerKeys] : systemKeys;
  const env = Object.fromEntries(keys.filter(key => inherited[key] !== undefined).map(key => [key, inherited[key]]));
  // Exact trusted host opt-in only; this grants no service, model or application authority.
  if (role === 'center' && inherited.FLOW_STARTUP_DIAGNOSTICS === 'v1') env.FLOW_STARTUP_DIAGNOSTICS = 'v1';
  return env;
}
export function serviceEnvironment(role, config, inherited = process.env, browserSession = null, backendHead = null, runnerSlot = null) {
  const env = baseServiceEnvironment(role, inherited);
  if (role === 'center') Object.assign(env, { DATABASE_URL: config.databaseUrl, FLOW_TOKEN: config.ownerToken,
    FLOW_PORT: String(config.centerPort), FLOW_HOST: '127.0.0.1', FLOW_ORIGIN: `http://127.0.0.1:${config.webPort}` });
  else if (role === 'runner') Object.assign(env, { FLOW_URL: `http://127.0.0.1:${config.centerPort}`, FLOW_RUNNER_TOKEN: (runnerSlot?.runner ?? config.runner).token,
    FLOW_RUNNER_WORKDIR: runnerSlot?.workdir ?? join(config.directory, 'runner'), FLOW_CLAUDE_MATERIALS_FILE: runnerSlot?.manifestPath ?? join(config.directory, 'claude.json') });
  else Object.assign(env, { FLOW_CENTER_URL: `http://127.0.0.1:${config.centerPort}`, VITE_FLOW_FIXTURE: 'false' });
  if (browserSession !== null) {
    const normalized = normalizeBrowserSessionSettings(browserSession);
    if (role === 'center') env.FLOW_BROWSER_SESSION_JSON = JSON.stringify(normalized);
    if (role === 'web') {
      if (!/^[a-f0-9]{40}$/.test(backendHead ?? '')) throw Object.assign(new Error('WEB_BACKEND_SOURCE_MISMATCH'), { code: 'WEB_BACKEND_SOURCE_MISMATCH' });
      env.FLOW_PREVIEW_WEB_COMPATIBILITY_CONTEXT = JSON.stringify(browserCompatibilityContext(normalized));
      env.FLOW_PREVIEW_WEB_BACKEND_HEAD = backendHead;
    }
  }
  return env;
}

/** Builds never inherit application/provider/VITE_* values or load private service configuration. */
export function buildEnvironment(inherited = process.env) {
  return { ...baseServiceEnvironment('web', inherited), NODE_ENV: 'production', VITE_FLOW_FIXTURE: 'false' };
}
