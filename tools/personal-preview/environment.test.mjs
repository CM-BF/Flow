import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { baseServiceEnvironment, serviceEnvironment } from './environment.mjs';

test('startup progress exact opt-in survives both center environment boundaries only', async () => {
  const inherited = { PATH: '/usr/bin', FLOW_STARTUP_DIAGNOSTICS: 'v1', PRIVATE_MARKER: 'secret' };
  const config = { directory: '/synthetic', databaseUrl: 'synthetic-db', ownerToken: 'synthetic-owner', runner: { token: 'synthetic-runner' }, centerPort: 1, webPort: 2 };
  const wrapper = baseServiceEnvironment('center', inherited);
  assert.equal(wrapper.FLOW_STARTUP_DIAGNOSTICS, 'v1');
  assert.equal(serviceEnvironment('center', config, wrapper).FLOW_STARTUP_DIAGNOSTICS, 'v1');
  assert.equal(wrapper.PRIVATE_MARKER, undefined);
  for (const role of ['runner', 'web']) {
    assert.equal(baseServiceEnvironment(role, inherited).FLOW_STARTUP_DIAGNOSTICS, undefined);
    assert.equal(serviceEnvironment(role, config, inherited).FLOW_STARTUP_DIAGNOSTICS, undefined);
  }
  const { buildEnvironment } = await import('./environment.mjs');
  assert.equal(buildEnvironment(inherited).FLOW_STARTUP_DIAGNOSTICS, undefined);
});

test('startup progress absent and unrecognized opt-ins preserve default center environment', () => {
  const baseline = baseServiceEnvironment('center', { PATH: '/usr/bin' });
  for (const value of [undefined, '', 'true', 'v2', 'v1\n', 'secret']) {
    assert.deepEqual(baseServiceEnvironment('center', { PATH: '/usr/bin', FLOW_STARTUP_DIAGNOSTICS: value }), baseline);
  }
});

const execute = promisify(execFile);
test('actual child environments isolate management and role credentials using synthetic markers', async () => {
  const inherited = { PATH: '/usr/bin:/bin', HOME: '/synthetic-home', LANG: 'C',
    FLOW_PREVIEW_ADMIN_URL: 'synthetic-admin-secret', DATABASE_URL: 'synthetic-inherited-database',
    PGPASSWORD: 'synthetic-pg-secret', FLOW_TOKEN: 'synthetic-inherited-owner', FLOW_RUNNER_TOKEN: 'synthetic-inherited-runner',
    VITE_SECRET: 'synthetic-browser-secret', NODE_OPTIONS: '--not-an-allowed-option', UNKNOWN_SECRET: 'synthetic-unknown',
    ANTHROPIC_API_KEY: 'synthetic-provider-auth' };
  const config = { directory: '/synthetic-private', databaseUrl: 'synthetic-owned-database', ownerToken: 'synthetic-owned-owner',
    runner: { token: 'synthetic-owned-runner' }, centerPort: 40001, webPort: 40002 };
  for (const role of ['center', 'runner', 'web']) {
    const wrapper = baseServiceEnvironment(role, inherited);
    const actual = serviceEnvironment(role, config, inherited);
    for (const env of [wrapper, actual]) {
      const { stdout } = await execute(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.env))'], { env, timeout: 2000 });
      const child = JSON.parse(stdout);
      for (const key of ['FLOW_PREVIEW_ADMIN_URL', 'PGPASSWORD', 'VITE_SECRET', 'NODE_OPTIONS', 'UNKNOWN_SECRET']) assert.equal(child[key], undefined);
      assert.equal(child.HOME, inherited.HOME);
      assert.equal(child.ANTHROPIC_API_KEY, role === 'runner' ? inherited.ANTHROPIC_API_KEY : undefined);
      const isService = env === actual;
      assert.equal(child.DATABASE_URL, isService && role === 'center' ? config.databaseUrl : undefined);
      assert.equal(child.FLOW_TOKEN, isService && role === 'center' ? config.ownerToken : undefined);
      assert.equal(child.FLOW_RUNNER_TOKEN, isService && role === 'runner' ? config.runner.token : undefined);
    }
  }
});

test('build environment strips all inherited application, provider and public VITE values', async () => {
  const { buildEnvironment } = await import('./environment.mjs');
  const env = buildEnvironment({ PATH: '/synthetic/bin', HOME: '/synthetic/home', FLOW_TOKEN: 'owner-marker', FLOW_PREVIEW_ADMIN_URL: 'admin-marker', DATABASE_URL: 'database-marker', ANTHROPIC_API_KEY: 'provider-marker', VITE_SECRET: 'public-marker', NODE_OPTIONS: '--require injected', NODE_ENV: 'development', VITE_FLOW_FIXTURE: 'true' });
  assert.deepEqual(env, { PATH: '/synthetic/bin', HOME: '/synthetic/home', NODE_ENV: 'production', VITE_FLOW_FIXTURE: 'false' });
});

test('SVC09 browser settings require the explicit host port and never leak through inherited environment', async () => {
  const settings = { cookieOrigin: 'https://public.example', trustedOrigins: ['https://public.example'], authEpoch: 'epoch1' };
  const inherited = { FLOW_BROWSER_SESSION_JSON: JSON.stringify(settings), FLOW_PREVIEW_BROWSER_POLICY_IDENTITY: 'forged',
    FLOW_PREVIEW_WEB_COMPATIBILITY_CONTEXT: 'forged', FLOW_PREVIEW_WEB_BACKEND_HEAD: 'f'.repeat(40) };
  const config = { directory: '/synthetic', databaseUrl: 'synthetic-db', ownerToken: 'synthetic-owner', runner: { token: 'synthetic-runner' }, centerPort: 1, webPort: 2 };
  for (const role of ['center', 'runner', 'web']) for (const key of Object.keys(inherited)) assert.equal(serviceEnvironment(role, config, inherited)[key], undefined);
  const center = serviceEnvironment('center', config, inherited, settings, 'a'.repeat(40));
  assert.deepEqual(JSON.parse(center.FLOW_BROWSER_SESSION_JSON), settings);
  const web = serviceEnvironment('web', config, inherited, settings, 'a'.repeat(40));
  assert.equal(web.FLOW_BROWSER_SESSION_JSON, undefined); assert.equal(web.FLOW_PREVIEW_WEB_BACKEND_HEAD, 'a'.repeat(40));
  assert.equal(JSON.parse(web.FLOW_PREVIEW_WEB_COMPATIBILITY_CONTEXT).publicOrigin, settings.cookieOrigin);
  assert.equal(serviceEnvironment('runner', config, inherited, settings).FLOW_BROWSER_SESSION_JSON, undefined);
  assert.throws(() => serviceEnvironment('web', config, inherited, settings), { code: 'WEB_BACKEND_SOURCE_MISMATCH' });
});

test('SVC09A settings environment changes only explicit runner identity and owned paths', () => {
  const config = { directory: '/fixture', centerPort: 1234, runner: { token: 'old' } };
  const slot = { runner: { token: 'new' }, workdir: '/fixture/runner-settings/work', manifestPath: '/fixture/runner-settings/claude.json' };
  const legacy = serviceEnvironment('runner', config, { HOME: '/synthetic', ANTHROPIC_AUTH_TOKEN: 'auth' });
  const settings = serviceEnvironment('runner', config, { HOME: '/synthetic', ANTHROPIC_AUTH_TOKEN: 'auth' }, null, null, slot);
  const expected = { ...legacy, FLOW_RUNNER_TOKEN: 'new', FLOW_RUNNER_WORKDIR: slot.workdir, FLOW_CLAUDE_MATERIALS_FILE: slot.manifestPath };
  assert.deepEqual(settings, expected); assert.equal(config.runner.token, 'old');
});
