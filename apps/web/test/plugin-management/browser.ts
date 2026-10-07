import { pluginRuntimeCommandSchema, type PluginRuntimeCommand } from '../../../../packages/contracts/src/plugin-runtime.js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, lstat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Page } from '@playwright/test';
import { createServer as createVite, type AliasOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { FlowClient } from '@flow/client';
import { type PluginCommand, type PluginSnapshot, type PluginVersionDeclaration } from '@flow/contracts';
import { createServer as createHttpServer } from 'node:http';

const fixtureUuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const runtimeRegistration = fixtureUuid(1), installedOperation = fixtureUuid(3), runnerIdentity = fixtureUuid(4);
const fixtureTime = '2026-10-07T10:00:00.000Z';
function runtimeSnapshot(revision: number): PluginSnapshot {
  return { revision, installation: { id: runtimeRegistration, scope: { workspaceId: 'personal', projectId: null }, packageName: 'fixture-tool', revision, registrationStatus: 'registered', runtimeStatus: 'unavailable', runtimeReason: 'package_not_verified_or_loaded', createdAt: fixtureTime, updatedAt: fixtureTime },
    version: { id: fixtureUuid(7), createdAt: fixtureTime, packageName: 'fixture-tool', packageVersion: '1.0.0', source: 'npm', declaredSha256: 'c'.repeat(64), license: 'MIT', hostApiMajor: 1, capabilities: ['tool'], publicConfiguration: [] }, configuration: {}, configurationStatus: 'ready', grants: ['tool'] };
}
function runtimeProjection(revision: number, enabled: boolean) {
  return { protocol: 'flow.plugin-runtime.v1', registrationId: runtimeRegistration, currentRevision: revision, enabledRevision: enabled ? revision : null,
    desiredEnabled: enabled, bindingAllowed: enabled, reason: enabled ? 'ready' : 'not-enabled', loaded: 'unknown', callable: 'unknown',
    materialInstallOperationId: enabled ? installedOperation : null, targetRunnerId: enabled ? runnerIdentity : null, storeId: enabled ? 'fixture-store' : null };
}
function runtimeAck(input: PluginRuntimeCommand) {
  const revision = input.expectedRevision + 1;
  return { replayed: false, runtime: runtimeProjection(revision, input.change.kind === 'enable'), snapshot: runtimeSnapshot(revision),
    operation: { id: fixtureUuid(9), installationId: runtimeRegistration, kind: input.change.kind, status: 'succeeded', actor: 'owner', inputDigest: 'd'.repeat(64), beforeRevision: input.expectedRevision, afterRevision: revision, createdAt: fixtureTime } };
}

/** Dedicated public-DTO HTTP fixture. No PG, package execution or production authorization proof. */
export async function createPluginRuntimeManagementFixture(options: { cacheDir: string; aliases: AliasOptions }) {
  const vite = await createVite({
    root: fileURLToPath(new URL('../..', import.meta.url)), configFile: false, envDir: false,
    cacheDir: options.cacheDir, resolve: { alias: options.aliases }, plugins: [react(), tailwindcss()],
    optimizeDeps: { entries: ['test/plugin-management/fixture/main.tsx'] }, logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false, proxy: {} },
  });
  const writes: { center: string; key: string; body: string }[] = [];
  const received = new Map<string, { body: string; acknowledgement: ReturnType<typeof runtimeAck> }>();
  let mode: 'ack' | 'reject' | 'unknown' | 'reject-retry' = 'ack';
  let revision = 1, enabled = false, bindingAvailable = true;
  let web = '';
  const api = createHttpServer(async (request, response) => {
    response.setHeader('access-control-allow-origin', web);
    response.setHeader('access-control-allow-headers', 'authorization,content-type,idempotency-key');
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    const send = (value: unknown, status = 200) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
    try {
      const url = new URL(request.url ?? '/', 'http://fixture.invalid');
      const center = url.pathname.startsWith('/B/') ? 'B' : 'A';
      const path = url.pathname.slice(2), observedRevision = center === 'A' ? revision : 1;
      const snapshot = runtimeSnapshot(observedRevision);
      if (request.method === 'GET') {
        if (path === '/api/plugins') { send({ installations: [snapshot.installation], nextCursor: null }); return; }
        if (path === `/api/plugins/${runtimeRegistration}`) { send(snapshot); return; }
        if (path === `/api/plugins/${runtimeRegistration}/runtime`) {
          const projection = runtimeProjection(observedRevision, center === 'A' && enabled);
          send(projection.desiredEnabled && !bindingAvailable ? { ...projection, bindingAllowed: false, reason: 'host-unavailable' } : projection); return;
        }
        if (path === `/api/plugins/${runtimeRegistration}/material-installs`) {
          send({ operations: [{ schemaVersion: 1, id: installedOperation, registrationId: runtimeRegistration, versionId: fixtureUuid(7), admittedRevision: 1, fetchOperationId: fixtureUuid(5), fetchAttemptId: fixtureUuid(6), artifactId: fixtureUuid(8), storeId: 'fixture-store', status: 'installed', materialId: 'a'.repeat(64), treeDigest: 'b'.repeat(64), hostApiMajor: 1, error: null, createdAt: fixtureTime, updatedAt: fixtureTime }], nextCursor: null }); return;
        }
      }
      if (request.method === 'POST' && path === `/api/plugins/${runtimeRegistration}/runtime/commands`) {
        let body = ''; for await (const chunk of request) { body += String(chunk); if (Buffer.byteLength(body) > 32768) throw new Error('Fixture body limit'); }
        if (writes.length >= 16) throw new Error('Fixture command count limit');
        const key = String(request.headers['idempotency-key'] ?? ''); const input = pluginRuntimeCommandSchema.parse(JSON.parse(body));
        writes.push({ center, key, body });
        if (center !== 'A' || !key || mode === 'reject' || mode === 'reject-retry') { send({ error: { code: 'plugin_revision_conflict', message: 'Fixture rejection' } }, 409); return; }
        const original = received.get(key);
        if (original) { if (original.body !== body) throw new Error('Frozen identity changed'); send({ ...original.acknowledgement, replayed: true }); return; }
        if (input.expectedRevision !== revision) { send({ error: { code: 'plugin_revision_conflict', message: 'Fixture revision changed' } }, 409); return; }
        const acknowledgement = runtimeAck(input); received.set(key, { body, acknowledgement }); revision++; enabled = input.change.kind === 'enable';
        if (mode === 'unknown') { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{'); return; }
        send(acknowledgement); return;
      }
      send({ error: { code: 'fixture_not_found', message: 'Fixture route missing' } }, 404);
    } catch { if (!response.headersSent) send({ error: { code: 'fixture_error', message: 'Fixture failed' } }, 500); else response.destroy(); }
  });
  async function close() {
    const results = await Promise.allSettled([new Promise<void>((resolve, reject) => { if (!api.listening) { resolve(); return; } api.close(error => error ? reject(error) : resolve()); api.closeAllConnections(); }), vite.close()]);
    const failed = results.filter(result => result.status === 'rejected'); if (failed.length) throw new AggregateError(failed, 'Owned fixture cleanup failed');
  }
  try {
    await vite.listen(); const address = vite.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing owned Vite port');
    web = `http://127.0.0.1:${address.port}`;
    await new Promise<void>((resolve, reject) => { api.once('error', reject); api.listen(0, '127.0.0.1', resolve); });
    const apiAddress = api.address(); if (!apiAddress || typeof apiAddress === 'string') throw new Error('Missing owned API port');
    return { url: `${web}/test/plugin-management/fixture/index.html`, input: { centers: [`http://127.0.0.1:${apiAddress.port}/A`, `http://127.0.0.1:${apiAddress.port}/B`], token: 'fixture-only', projectId: fixtureUuid(10), emptyProjectId: fixtureUuid(11), runtimeManagement: true },
      writes, setMode(value: typeof mode) { mode = value; }, setBindingAvailable(value: boolean) { bindingAvailable = value; }, close };
  } catch (error) { try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Fixture start and cleanup failed'); } throw error; }
}

/** Caller owns the browser/context/profile and invokes this once within its bounded segment. */
export async function runPluginRuntimeManagementChecks(page: Page, fixture: Awaited<ReturnType<typeof createPluginRuntimeManagementFixture>>, saveScreenshot: (name: string, body: Buffer) => Promise<void>) {
  const checks: string[] = [];
  await page.addInitScript(`window.__X03_INPUT__ = ${JSON.stringify(fixture.input)};`);
  await page.goto(fixture.url);
  const open = () => page.getByRole('button', { name: 'Open plugin management', exact: true }).click();
  const select = () => page.getByRole('button', { name: 'View fixture-tool', exact: true }).click();
  const notice = page.getByRole('region', { name: '插件启停命令', exact: true });
  const panel = page.getByRole('region', { name: '中心插件运行时', exact: true });
  await open(); await select();
  await panel.getByText('高级执行后端与完整安装身份', { exact: true }).click();
  await page.getByLabel('执行后端 UUID', { exact: true }).fill(runnerIdentity);
  await panel.locator(`input[type="radio"][value="${installedOperation}"]`).check();
  await page.getByLabel('变更原因', { exact: true }).fill('Fixture explicit enable');
  fixture.setMode('reject'); await panel.getByRole('button', { name: '确认启用', exact: true }).click();
  await expect(notice).toContainText('明确拒绝'); await expect(page.getByLabel('变更原因', { exact: true })).toHaveValue('Fixture explicit enable');
  expect(fixture.writes).toHaveLength(1); checks.push('initial typed409 preserves the command draft');
  fixture.setMode('unknown'); await panel.getByRole('button', { name: '确认启用', exact: true }).click();
  await expect(notice).toContainText('启停结果未知'); expect(fixture.writes).toHaveLength(2);
  const original = { ...fixture.writes[1]! };
  await page.getByRole('button', { name: 'Close plugin management', exact: true }).click(); await open();
  await expect(notice).toContainText('启停结果未知');
  await page.getByRole('button', { name: 'Collapse plugin management', exact: true }).click();
  await page.getByRole('button', { name: 'Expand plugin management', exact: true }).click();
  await expect(notice).toContainText('启停结果未知'); await select();
  await expect(panel.getByRole('button', { name: '确认启用', exact: true })).toBeDisabled();
  const unknownRefresh = panel.getByRole('button', { name: '刷新启停状态（只读）', exact: true });
  await expect(unknownRefresh).toBeEnabled();
  const decodedReads = await page.evaluate(() => window.__X03_TEST__.runtimeReadCount);
  await unknownRefresh.click();
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.runtimeReadCount)).toBe(decodedReads + 1);
  await expect(unknownRefresh).toBeEnabled();
  await expect(notice).toContainText('启停结果未知');
  expect(fixture.writes).toHaveLength(2);
  fixture.setMode('reject-retry'); await notice.getByRole('button', { name: '重试原启停命令', exact: true }).click();
  await expect(notice).toContainText('重试返回 409'); expect(fixture.writes).toHaveLength(3); expect(fixture.writes[2]).toEqual(original);
  checks.push('UNKNOWN survives lazy close/collapse, successful read and rejected original retry');
  fixture.setMode('ack'); await notice.getByRole('button', { name: '重试原启停命令', exact: true }).click();
  await expect(notice).toContainText('中心已确认'); expect(fixture.writes[3]).toEqual(original);
  fixture.setBindingAvailable(false);
  await panel.getByRole('button', { name: '刷新启停状态（只读）', exact: true }).click();
  await expect(panel.getByText('执行后端当前不可用', { exact: true })).toBeVisible();
  await expect(panel.locator('dt').filter({ hasText: /^可创建绑定$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('否');
  expect(fixture.writes).toHaveLength(4);
  checks.push('later same-revision HTTP observation overrides historical ready ACK without another write');
  await page.getByLabel('变更原因', { exact: true }).fill('Fixture explicit disable');
  await panel.getByRole('button', { name: '确认停用', exact: true }).click();
  await expect(panel.getByRole('button', { name: '确认停用', exact: true })).toBeDisabled();
  expect(fixture.writes).toHaveLength(5); expect(fixture.writes[4]!.key).not.toBe(original.key);
  checks.push('only original accepted replay resolves UNKNOWN; explicit disable uses a new identity');
  await panel.getByText('高级执行后端与完整安装身份', { exact: true }).click();
  await page.evaluate(() => { window.__X03_TEST__.holdNextRuntimeAck = true; });
  await panel.getByRole('button', { name: '确认启用', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.runtimeAckReady)).toBe(true);
  await page.getByRole('button', { name: 'Switch center', exact: true }).click(); await select();
  await expect(page.getByLabel('Fixture center', { exact: true })).toHaveText('Center B');
  await page.evaluate(() => window.__X03_TEST__.releaseRuntime?.());
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.runtimeAckDelivered)).toBe(true);
  await expect(notice).toHaveCount(0); await expect(panel).toContainText('尚未启用');
  expect(fixture.writes.every(write => write.center === 'A')).toBe(true); checks.push('decoded old-session ACK cannot replace the new center state');
  await page.setViewportSize({ width: 390, height: 844 });
  const refresh = panel.getByRole('button', { name: '刷新启停状态（只读）', exact: true });
  await expect(refresh).toBeEnabled();
  const keyboardReadCount = await page.evaluate(() => window.__X03_TEST__.runtimeReadCount);
  await refresh.focus(); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.runtimeReadCount)).toBe(keyboardReadCount + 1);
  await expect(refresh).toBeEnabled();
  await expect(refresh).toBeFocused();
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
    await panel.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await saveScreenshot(`plugin-runtime-${theme}-390.png`, await page.screenshot());
  }
  checks.push('bounded fixture keyboard refresh and two 390px themes; not production Settings');
  return { checks, writes: fixture.writes, boundary: 'Synthetic public DTOs over actual owned HTTP and real FlowClient codecs; no PG/runtime/production App proof.' };
}

/** Historical two-center journey: explicit entry only; never runs on module import. */
export async function runLegacyPluginManagementBrowser() {
const { Pool } = await import('pg');
const { createServer: createCenter } = await import('../../../server/src/index');
const output = fileURLToPath(new URL(`../../../../docs/evidence/x01/enable-binding-browser-${randomUUID()}/`, import.meta.url));
let outputIdentity: { dev: number; ino: number } | undefined;
async function save(name: string, content: string | Buffer) {
  const current = await lstat(output);
  if (!outputIdentity || !current.isDirectory() || current.isSymbolicLink() || current.dev !== outputIdentity.dev || current.ino !== outputIdentity.ino) throw new Error('Owned evidence directory identity changed.');
  await writeFile(output + name, content, { flag: 'wx', mode: 0o600 });
}
const startedAt = new Date().toISOString();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const adminConnection = new URL('postgresql://flow:flow-local-only@127.0.0.1:55432/postgres');
const admin = new Pool({ connectionString: adminConnection.href, max: 1 });
const created: string[] = [];
const pools: import('pg').Pool[] = [];
const servers: Awaited<ReturnType<typeof createCenter>>[] = [];
const token = randomUUID();
const checks: string[] = [];
const requests: { center: number; method: string; path: string }[] = [];
const errors: string[] = [];
let vite: Awaited<ReturnType<typeof createVite>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let failure: string | undefined;
let boundaryMeasurements: unknown;
let browserStartRequest = 0;
const longKey = 'configuration' + 'x'.repeat(35);
const longVersion = '1.0.0-' + 'x'.repeat(122);
try {
  await mkdir(output, { mode: 0o700 });
  const outputStat = await lstat(output); outputIdentity = { dev: outputStat.dev, ino: outputStat.ino };
  vite = await createVite({ root: fileURLToPath(new URL('../..', import.meta.url)), server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await vite.listen();
  const address = vite.httpServer!.address() as { port: number };
  const web = `http://127.0.0.1:${address.port}`;
  const connections: string[] = [];
  const urls: string[] = [];
  const start = async (index: number) => {
    const server = await createCenter({ databaseUrl: connections[index]!, ownerToken: token, allowedOrigin: web });
    server.addHook('onRequest', async request => { if (request.method !== 'OPTIONS') requests.push({ center: index, method: request.method, path: request.url }); });
    servers[index] = server;
    urls[index] = await server.listen({ host: '127.0.0.1', port: 0 });
  };
  for (let index = 0; index < 2; index++) {
    const name = `flow_x03_${process.pid}_${index}_${randomUUID().slice(0, 8)}`;
    await admin.query(`CREATE DATABASE "${name}"`); created.push(name);
    const connection = new URL(adminConnection); connection.pathname = `/${name}`;
    connections.push(connection.href); pools.push(new Pool({ connectionString: connection.href, max: 2, application_name: 'x03-fixture-copy' }));
    await start(index);
  }
  let owner = new FlowClient({ baseUrl: urls[0]!, token });
  const version = (name: string): PluginVersionDeclaration => ({ packageName: name, packageVersion: '1.0.0', source: 'npm', declaredSha256: 'a'.repeat(64), license: 'MIT', hostApiMajor: 1,
    capabilities: ['renderer'], publicConfiguration: [{ key: 'enabledFeature', kind: 'boolean', required: true }, { key: longKey, kind: 'boolean', required: true }] });
  for (let index = 0; index < 11; index++) await owner.registerPlugin({ scope: { workspaceId: 'personal', projectId: null }, version: version(`@flow-test/registered-${index}`) }, randomUUID());
  const target = (await owner.plugins({ limit: 40 })).installations[0]!;
  let snapshot = await owner.plugin(target.id);
  const changes: PluginCommand['change'][] = [{ kind: 'configure', values: { enabledFeature: true, [longKey]: true } }, { kind: 'set-grants', capabilities: ['renderer'] }];
  for (const change of changes)
    snapshot = (await owner.commandPlugin(target.id, { expectedRevision: snapshot.revision, reason: 'X03 isolated browser evidence', change }, randomUUID())).snapshot;
  for (let index = 1; index <= 11; index++) snapshot = (await owner.commandPlugin(target.id, { expectedRevision: snapshot.revision, reason: 'X03 bounded pagination',
    change: { kind: 'register-version', version: { ...version(target.packageName), packageVersion: index === 11 ? longVersion : `1.0.${index}` } } }, randomUUID())).snapshot;
  const project = await owner.createProject({ workspaceId: 'personal', title: 'Design review' }, randomUUID());
  const projectId = project.snapshot.project.id;
  const emptyProjectId = (await owner.createProject({ workspaceId: 'personal', title: 'Empty project' }, randomUUID())).snapshot.project.id;
  await owner.registerPlugin({ scope: { workspaceId: 'personal', projectId }, version: version('@flow-test/project-only') }, randomUUID());
  await servers[0]!.close(); await start(0);
  owner = new FlowClient({ baseUrl: urls[0]!, token });
  expect(await owner.plugin(target.id)).toEqual(snapshot);
  checks.push('public client registers config/grants/versions; same revision survives real center restart');

  // Deliberate same-ID collision in two independent databases; no shared persistence or ID rewriting.
  const destination = await pools[1]!.connect();
  try {
    await destination.query('BEGIN');
    for (const table of ['plugin_installations', 'plugin_versions', 'plugin_revisions', 'plugin_operations']) {
      const key = table === 'plugin_installations' ? 'id' : 'installation_id';
      const rows = (await pools[0]!.query(`SELECT * FROM flow.${table} WHERE ${key}=$1`, [target.id])).rows;
      await destination.query(`INSERT INTO flow.${table} SELECT * FROM json_populate_recordset(NULL::flow.${table}, $1::json)`, [JSON.stringify(rows)]);
    }
    await destination.query('COMMIT');
  } catch (error) { await destination.query('ROLLBACK'); throw error; }
  finally { destination.release(); }
  const second = new FlowClient({ baseUrl: urls[1]!, token });
  await second.commandPlugin(target.id, { expectedRevision: snapshot.revision, reason: 'Independent center B configuration', change: { kind: 'configure', values: { enabledFeature: false, [longKey]: false } } }, randomUUID());
  const baselineRequests = requests.length; browserStartRequest = baselineRequests;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(input => { window.__X03_INPUT__ = input; }, { centers: urls, token, projectId, emptyProjectId });
  await page.goto(`${web}/test/plugin-management/fixture/index.html`);
  await page.waitForLoadState('networkidle');
  expect(requests.slice(baselineRequests)).toEqual([]);
  checks.push('closed view sends zero registry requests');
  await page.getByRole('button', { name: 'Open plugin management', exact: true }).click();
  await expect(page.getByRole('button', { name: `View ${target.packageName}`, exact: true })).toBeVisible({ timeout: 3000 });
  checks.push('opened view reads scoped real registry');
  const reads = () => requests.slice(baselineRequests).filter(request => request.method === 'GET');
  const registry = page.getByRole('region', { name: 'Center registry', exact: true });
  const local = page.getByRole('region', { name: 'Browser extensions', exact: true });
  expect(reads()).toHaveLength(1);
  expect(reads()[0]!.path).toBe('/api/plugins?limit=10');
  await expect(registry.getByText('Personal workspace registrations', { exact: true })).toBeVisible();
  await expect(registry.locator('.flow-plugin-row')).toHaveCount(10);
  await expect(local.locator('.flow-plugin-status')).toHaveText(['registered', 'registered']);
  const nextRegistry = page.getByRole('button', { name: 'Next registry page', exact: true });
  await nextRegistry.focus(); await page.keyboard.press('Enter');
  await expect(registry.locator('.flow-plugin-row')).toHaveCount(1);
  await expect(nextRegistry).toBeFocused();
  expect(reads().at(-1)!.path).toMatch(/after=.+&limit=10/);
  await page.getByRole('button', { name: 'First registry page', exact: true }).click();
  const selectTarget = () => page.getByRole('button', { name: `View ${target.packageName}`, exact: true });
  await expect(selectTarget()).toBeVisible();
  expect(reads().filter(request => request.path.includes('/versions') || request.path.includes('/operations'))).toHaveLength(0);
  await selectTarget().click();
  await expect(page.getByRole('heading', { name: `Registration revision ${snapshot.revision}`, exact: true })).toBeVisible();
  await expect(page.getByLabel('Public configuration', { exact: true })).toContainText('enabledFeaturetrue');
  await expect(page.getByRole('region', { name: 'Registration details', exact: true })).toContainText('renderer');
  await expect(registry).toContainText('Unavailable: package has not been verified or loaded.');
  expect(reads().filter(request => request.path.includes('/versions') || request.path.includes('/operations'))).toHaveLength(0);
  checks.push('bounded 10-row scoped list, nextCursor replacement, detail only on expansion, config/grants match durable revision');
  await page.getByRole('button', { name: 'Show versions', exact: true }).click();
  const versions = page.getByRole('region', { name: 'Registered versions', exact: true });
  await expect(versions.locator('li')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next versions page', exact: true }).click();
  await expect(versions.locator('li')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Next versions page', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Show audit history', exact: true }).click();
  const audit = page.getByRole('region', { name: 'Registration audit', exact: true });
  await expect(audit.locator('li')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next audit page', exact: true }).click();
  await expect(audit.locator('li')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Next audit page', exact: true })).toBeFocused();
  expect(reads().filter(request => request.path.includes('/versions'))).toHaveLength(2);
  expect(reads().filter(request => request.path.includes('/operations'))).toHaveLength(2);
  checks.push('versions 10+2 and audit 10+4 use public paginated reads only after user expansion');
  // Synthetic bounded public read fixtures exercise the additive labels, not a production enable action.
  await page.route(`**/api/plugins/${target.id}/operations*`, async route => {
    const response = await route.fetch(); const body = await response.json();
    body.operations[0] = { ...body.operations[0], kind: 'enable' };
    body.operations[1] = { ...body.operations[1], kind: 'disable' };
    await route.fulfill({ response, json: body });
  }, { times: 1 });
  await page.getByRole('button', { name: 'First audit page', exact: true }).click();
  await expect(audit).toContainText('Enabled for new tool tasks');
  await expect(audit).toContainText('Disabled for new tool tasks');
  checks.push('bounded audit DTO fixtures render enable/disable labels without implying package load');
  await page.getByRole('button', { name: 'Activate trusted extension', exact: true }).click();
  const trusted = local.getByRole('listitem').filter({ hasText: 'trusted.example' });
  await expect(trusted.locator('.flow-plugin-status')).toHaveText('active');
  await page.getByRole('button', { name: 'Disable trusted extension', exact: true }).click();
  await expect(trusted.locator('.flow-plugin-status')).toHaveText('disabled');
  await page.getByRole('button', { name: 'Fail extension', exact: true }).click();
  await expect(local.getByRole('listitem').filter({ hasText: 'broken.example' }).locator('.flow-plugin-status')).toHaveText('failed');
  await expect(local).toContainText('Fixture activation failed.');
  const contextKeys = await page.evaluate(() => window.__X03_TEST__.contextKeys);
  expect(contextKeys).not.toContain('client'); expect(contextKeys).not.toContain('token');
  expect(contextKeys).not.toContain('registry'); expect(contextKeys).not.toContain('plugins');
  await expect(registry).toContainText('runtime unavailable');
  checks.push('real trusted host activate/disable/fail observed independently; no registry/client/token in PluginContext');

  await page.getByRole('button', { name: 'Use project scope', exact: true }).click();
  await expect(registry.getByRole('button', { name: 'View @flow-test/project-only', exact: true })).toBeVisible();
  await expect(registry.locator('.flow-plugin-row')).toHaveCount(1);
  expect(reads().at(-1)!.path).toContain(`projectId=${projectId}`);
  await expect(registry).toContainText('Project registrations · Design review');
  await page.getByRole('button', { name: 'Use empty scope', exact: true }).click();
  await expect(registry).toContainText('No plugins registered in this scope.');
  expect(reads().at(-1)!.path).toContain(`projectId=${emptyProjectId}`);
  await page.getByRole('button', { name: 'Use personal scope', exact: true }).click();
  await expect(selectTarget()).toBeVisible();
  checks.push('project scope forwarded, personal/project data separated, empty scope described');

  const listRoute = /\/api\/plugins\?/;
  for (const unavailable of [503, 401, 'offline'] as const) {
    let intercepted = 0;
    await page.route(listRoute, route => {
      intercepted++;
      return unavailable === 'offline' ? route.abort('connectionrefused') : route.fulfill({ status: unavailable, contentType: 'application/json', body: '{"error":"fixture_read_unavailable"}' });
    });
    await page.getByRole('button', { name: 'Refresh registry', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Could not load registry from this center.');
    await page.waitForLoadState('networkidle');
    expect(intercepted).toBe(1);
    await page.unroute(listRoute);
    await page.getByRole('button', { name: 'Retry registry', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Refresh registry', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await expect(selectTarget()).toBeVisible();
  }
  const readsBeforeRefresh = reads().length;
  await page.getByRole('button', { name: 'Refresh registry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh registry', exact: true })).toHaveAttribute('aria-disabled', 'false');
  await expect.poll(() => reads().length).toBe(readsBeforeRefresh + 1);
  await expect(page.getByRole('button', { name: 'Refresh registry', exact: true })).toBeFocused();
  checks.push('401/503/offline read errors visible, explicit retry recovers without auto loop; refresh and next-page controls retain focus');

  await page.evaluate(() => { window.__X03_TEST__.holdNextDetail = true; window.__X03_TEST__.detailReady = false; });
  await selectTarget().click();
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.detailReady)).toBe(true);
  const abortsBefore = await page.evaluate(() => window.__X03_TEST__.aborted);
  await page.getByRole('button', { name: 'Close plugin management', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Plugin management', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.aborted)).toBeGreaterThan(abortsBefore);
  const closedCount = reads().length;
  await page.getByRole('button', { name: 'Switch center', exact: true }).click();
  await page.waitForLoadState('networkidle');
  expect(reads()).toHaveLength(closedCount);
  await page.getByRole('button', { name: 'Open plugin management', exact: true }).click();
  await expect(selectTarget()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Registration details', exact: true })).toHaveCount(0);
  await selectTarget().click();
  await expect(page.getByLabel('Public configuration', { exact: true })).toContainText('enabledFeaturefalse');
  await page.evaluate(() => window.__X03_TEST__.release?.());
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Public configuration', { exact: true })).toContainText('enabledFeaturefalse');
  await expect(page.getByRole('heading', { name: `Registration revision ${snapshot.revision + 1}`, exact: true })).toBeVisible();
  expect((await second.plugin(target.id)).configuration.enabledFeature).toBe(false);
  checks.push('close aborts reads; same-ID different-center data isolated; ignored-abort late result rejected; closed center switch zero reads');

  await page.evaluate(() => { window.__X03_TEST__.holdNextDetail = true; window.__X03_TEST__.detailReady = false; });
  await page.getByRole('button', { name: 'Refresh registration', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.detailReady)).toBe(true);
  await expect(page.getByRole('button', { name: 'Refresh registration', exact: true })).toBeFocused();
  const openSwitchAborts = await page.evaluate(() => window.__X03_TEST__.aborted);
  await page.getByRole('button', { name: 'Switch center', exact: true }).click();
  await expect(selectTarget()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Registration details', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__X03_TEST__.aborted)).toBeGreaterThan(openSwitchAborts);
  await selectTarget().click();
  await expect(page.getByLabel('Public configuration', { exact: true })).toContainText('enabledFeaturetrue');
  await page.evaluate(() => window.__X03_TEST__.release?.());
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Public configuration', { exact: true })).toContainText('enabledFeaturetrue');
  checks.push('open view session change aborts old detail and rejects old-center late result with the same plugin ID');

  await save('module-light-desktop.png', await page.screenshot({ fullPage: true }));
  await page.setViewportSize({ width: 390, height: 844 });
  await selectTarget().focus(); await page.keyboard.press('Space');
  await expect(selectTarget()).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(selectTarget()).toHaveAttribute('aria-expanded', 'true');
  await expect(selectTarget()).toBeFocused();
  expect(await selectTarget().evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Show versions', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Registered versions', exact: true }).locator('li')).toHaveCount(10);
  if (await page.getByText(longVersion, { exact: true }).count() === 0) {
    await page.getByRole('button', { name: 'Next versions page', exact: true }).click();
  }
  await expect(page.getByText(longVersion, { exact: true })).toBeVisible();
  const keyBounds = await page.getByLabel('Public configuration', { exact: true }).locator('dt').filter({ hasText: longKey }).evaluate(node => {
    const box = node.getBoundingClientRect(); const value = node.nextElementSibling!.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(node);
    return { right: box.right, valueLeft: value.left, textRights: Array.from(range.getClientRects(), rect => rect.right) };
  });
  expect(keyBounds.right).toBeLessThanOrEqual(keyBounds.valueLeft);
  for (const right of keyBounds.textRights) expect(right).toBeLessThanOrEqual(keyBounds.right + 1);
  const versionBounds = await page.getByText(longVersion, { exact: true }).evaluate(node => {
    const right = node.closest('li')!.getBoundingClientRect().right; const range = document.createRange(); range.selectNodeContents(node);
    return { right, textRights: Array.from(range.getClientRects(), rect => rect.right) };
  });
  for (const right of versionBounds.textRights) expect(right).toBeLessThanOrEqual(versionBounds.right + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  boundaryMeasurements = { keyLength: longKey.length, versionLength: longVersion.length, keyBounds, versionBounds };
  checks.push('legal 48-character key and 128-character semver wrap at 390px without clipping, overlap or page overflow');
  await page.getByRole('button', { name: 'Hide versions', exact: true }).click();
  await save('module-light-390.png', await page.screenshot({ fullPage: true }));
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await save('module-dark-390.png', await page.screenshot({ fullPage: true }));
  checks.push('390px light/dark no horizontal overflow, keyboard expansion and visible focus');
  expect(errors).toEqual([]);
} catch (error) { failure = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
finally {
  if (outputIdentity) {
    try { await save('browser-progress.json', JSON.stringify({ startedAt, recordedAt: new Date().toISOString(), exitCode: process.exitCode ?? 0, checks, failure, pageErrors: errors, phase: 'before resource cleanup' }, null, 2)); }
    catch { process.exitCode = 1; failure ??= 'Owned progress evidence could not be saved.'; }
  }
  const closeErrors: { resource: string; message: string }[] = [];
  const close = async (resource: string, operation: () => Promise<unknown>) => {
    try { await operation(); }
    catch (error) { process.exitCode = 1; closeErrors.push({ resource, message: error instanceof Error ? error.message : String(error) }); }
  };
  await close('browser', async () => browser?.close()); await close('vite', async () => vite?.close());
  await Promise.all(servers.map((server, index) => close(`center-${index}`, () => server.close())));
  await Promise.all(pools.map((pool, index) => close(`fixture-pool-${index}`, () => pool.end())));
  const cleanup: { database: string; remaining: number; closingConnections: unknown[] }[] = [];
  try {
    for (const name of created) {
      const closingConnections = (await admin.query('SELECT application_name,state,count(*)::int AS connections FROM pg_stat_activity WHERE datname=$1 GROUP BY application_name,state', [name])).rows;
      await close(`database-${name}`, async () => {
      await expect.poll(async () => Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE datname=$1', [name])).rows[0].count), { timeout: 5000, intervals: [25, 50, 100] }).toBe(0);
      await admin.query(`DROP DATABASE "${name}"`);
      });
      cleanup.push({ database: name, closingConnections, remaining: (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rowCount ?? -1 });
    }
  } finally { await admin.end(); }
  const result = { sourceCommit, startedAt, completedAt: new Date().toISOString(), exitCode: process.exitCode ?? 0, checks, failure, pageErrors: errors, closeErrors, cleanup, boundaryMeasurements, reads: requests.slice(browserStartRequest),
    boundary: 'Isolated module fixture, real PG/HTTP/host. Production App mounting is separate acceptance.' };
  if (outputIdentity) await save('browser-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

}
