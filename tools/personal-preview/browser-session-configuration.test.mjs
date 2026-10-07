import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, chmod, link, symlink, unlink, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeBrowserSessionSettings, browserCompatibilityContext, validateBrowserCompatibilityContext,
  readBrowserSessionConfiguration, pinnedBrowserSessionConfiguration, browserSessionLaunchEnvironment, readBrowserSessionLaunch } from './browser-session-configuration.mjs';
const settings = { cookieOrigin: 'http://127.0.0.1:40000', trustedOrigins: ['https://example.test', 'http://127.0.0.1:40000'], authEpoch: 'one' };
async function fixture(run) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc09-policy-')));
  const config = { directory, installationId: randomUUID() }; const path = join(directory, 'browser-session.json');
  const write = (value = settings, installationId = config.installationId) => writeFile(path, JSON.stringify({ format: 1, installationId, browserSession: value }), { mode: 0o600 });
  try { await run({ config, path, write }); } finally { await rm(directory, { recursive: true }); }
}
test('SVC09 absent policy is legacy and inherited settings cannot activate it', async () => {
  await fixture(async ({ config }) => {
    const actual = await readBrowserSessionLaunch(config, { FLOW_BROWSER_SESSION_JSON: JSON.stringify(settings) });
    assert.equal(actual.settings, null); assert.equal(actual.context, null); assert.equal(actual.pin.file, null);
  });
});
test('SVC09 canonical settings and context preserve origin epoch and normalize only trust order', () => {
  assert.deepEqual(browserCompatibilityContext(settings), browserCompatibilityContext({ ...settings, trustedOrigins: [...settings.trustedOrigins].reverse() }));
  assert.notDeepEqual(browserCompatibilityContext(settings), browserCompatibilityContext({ ...settings, authEpoch: 'two' }));
  for (const bad of [ { ...settings, cookieOrigin: 'https://example.test/' }, { ...settings, cookieOrigin: 'http://example.test' }, { ...settings, trustedOrigins: ['https://example.test', 'https://example.test'] }, { ...settings, authEpoch: '' }, { ...settings, token: 'forbidden' } ]) assert.throws(() => normalizeBrowserSessionSettings(bad), { code: 'BROWSER_CONFIGURATION_INVALID' });
  assert.throws(() => validateBrowserCompatibilityContext({ ...browserCompatibilityContext(settings), extra: true }), { code: 'WEB_COMPATIBILITY_CONTEXT_INVALID' });
});
test('SVC09 private policy identity and exact bytes survive owned wrapper revalidation', async () => {
  await fixture(async ({ config, write }) => {
    await write(); const initial = await pinnedBrowserSessionConfiguration(config);
    const env = browserSessionLaunchEnvironment(initial);
    assert.deepEqual((await readBrowserSessionLaunch(config, env)).context, browserCompatibilityContext(settings));
    assert.equal(initial.pin.file.bytes, String(Buffer.byteLength(JSON.stringify({ format: 1, installationId: config.installationId, browserSession: settings }))));
    await assert.rejects(readBrowserSessionLaunch(config, {}), { code: 'BROWSER_CONFIGURATION_CHANGED' });
    await assert.rejects(readBrowserSessionLaunch(config, { ...env, FLOW_PREVIEW_BROWSER_POLICY_IDENTITY: '{}' }), { code: 'BROWSER_CONFIGURATION_CHANGED' });
  });
});
test('SVC09 invalid owner installation mode hardlink and symlink are rejected without legacy fallback', async () => {
  await fixture(async ({ config, path, write }) => {
    await write(settings, randomUUID()); await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
    await write(); await chmod(path, 0o644); await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
    await chmod(path, 0o600); await link(path, path + '.alias'); await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
    await unlink(path + '.alias'); await rename(path, path + '.original'); await symlink(path + '.original', path);
    await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
  });
});
test('SVC09 policy size schema and changed private root fail closed', async () => {
  await fixture(async ({ config, path, write }) => {
    await write(); await writeFile(path, 'x'.repeat(4097)); await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
    await writeFile(path, '{'); await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
    await write(); await chmod(config.directory, 0o755); await assert.rejects(readBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_INVALID' });
  });
});
test('SVC09 appearance disappearance replacement and content changes cannot reuse a preflight pin', async () => {
  await fixture(async ({ config, path, write }) => {
    await pinnedBrowserSessionConfiguration(config); await write(); await assert.rejects(pinnedBrowserSessionConfiguration(config), { code: 'BROWSER_CONFIGURATION_CHANGED' });
    const presentConfig = { ...config }; await pinnedBrowserSessionConfiguration(presentConfig);
    await rename(path, path + '.old'); await write(); await assert.rejects(pinnedBrowserSessionConfiguration(presentConfig), { code: 'BROWSER_CONFIGURATION_CHANGED' });
    const changed = { ...config }; await pinnedBrowserSessionConfiguration(changed); await write({ ...settings, authEpoch: 'two' });
    await assert.rejects(pinnedBrowserSessionConfiguration(changed), { code: 'BROWSER_CONFIGURATION_CHANGED' });
    const removed = { ...config }; await pinnedBrowserSessionConfiguration(removed); await unlink(path);
    await assert.rejects(pinnedBrowserSessionConfiguration(removed), { code: 'BROWSER_CONFIGURATION_CHANGED' });
  });
});
