import { join } from 'node:path';

const systemKeys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ'];
const providerKeys = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR', 'ANTHROPIC_BASE_URL',
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];

/** Only runner receives provider authentication; no inherited application credentials cross this boundary. */
export function baseServiceEnvironment(role, inherited = process.env) {
  if (!['center', 'runner', 'web'].includes(role)) throw new Error('Unknown preview service.');
  const keys = role === 'runner' ? [...systemKeys, ...providerKeys] : systemKeys;
  return Object.fromEntries(keys.filter(key => inherited[key] !== undefined).map(key => [key, inherited[key]]));
}
export function serviceEnvironment(role, config, inherited = process.env) {
  const env = baseServiceEnvironment(role, inherited);
  if (role === 'center') Object.assign(env, { DATABASE_URL: config.databaseUrl, FLOW_TOKEN: config.ownerToken,
    FLOW_PORT: String(config.centerPort), FLOW_HOST: '127.0.0.1', FLOW_ORIGIN: `http://127.0.0.1:${config.webPort}` });
  else if (role === 'runner') Object.assign(env, { FLOW_URL: `http://127.0.0.1:${config.centerPort}`, FLOW_RUNNER_TOKEN: config.runner.token,
    FLOW_RUNNER_WORKDIR: join(config.directory, 'runner'), FLOW_CLAUDE_MATERIALS_FILE: join(config.directory, 'claude.json') });
  else Object.assign(env, { FLOW_CENTER_URL: `http://127.0.0.1:${config.centerPort}`, VITE_FLOW_FIXTURE: 'false' });
  return env;
}
