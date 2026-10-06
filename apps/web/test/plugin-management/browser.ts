import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, lstat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { chromium, expect } from '@playwright/test';
import { createServer as createVite } from 'vite';
import { FlowClient } from '@flow/client';
import type { PluginCommand, PluginVersionDeclaration } from '@flow/contracts';
import { createServer as createCenter } from '../../../server/src/index';

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
const pools: Pool[] = [];
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
