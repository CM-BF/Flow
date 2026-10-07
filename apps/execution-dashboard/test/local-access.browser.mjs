import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDashboardServer } from '../src/server.mjs';

const FAKE_TOKEN = 'synthetic_browser_owner_token_for_checks_123456';
const snapshot = {
  generatedAt: '2026-10-07T00:00:00Z', tasks: [], unregisteredAssignments: [],
  main: { available: false, observedAt: '2026-10-07T00:00:00Z', worktree: 'isolated fixture' },
  overview: { phase: 'isolated fixture', activeIds: [], otherActiveIds: [], deliveryIds: [], decisionIds: [], blockerIds: [], unknownIds: [], historyIds: [] },
};

// The caller owns its isolated browser, deadline/resource supervision and final cleanup receipt.
// No launcher, real registry, personal endpoint or credential is used by this fixture.
export async function checkLocalAccessBrowser({ browser, expect, outputDirectory }) {
  const report = { state: 'RUNNING', checks: [], fakeCredentialOnly: true, errors: [], cleanup: {} };
  let reads = 0;
  let delayNext = false;
  let releaseRead;
  let notifyRead;
  const provider = {
    metadata: { enabled: true, productUrl: 'http://127.0.0.1:61228/' },
    async readOwnerToken() {
      reads += 1;
      if (delayNext) {
        delayNext = false;
        notifyRead?.();
        await new Promise(resolve => { releaseRead = resolve; });
      }
      return FAKE_TOKEN;
    },
  };
  const server = createDashboardServer({ tasks: [] }, { localAccess: provider });
  let context;
  try {
    await mkdir(outputDirectory, { recursive: true });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    // Explicit empty snapshot keeps the real dashboard entry while preventing aggregate/Git/ledger reads.
    await context.route(`${origin}/api/snapshot`, route => route.fulfill({ json: snapshot }));
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    const open = page.getByRole('button', { name: '本机登录凭据', exact: true });
    const dialog = page.getByRole('dialog', { name: '本机登录凭据', exact: true });
    const token = page.getByLabel('Owner token', { exact: true });
    const load = dialog.getByRole('button', { name: '加载 owner token', exact: true });
    const message = page.locator('#local-access-status');
    await expect(page.locator('#local-access-availability')).toContainText('已启用');
    assert.equal(reads, 0);
    await expect(page.getByRole('link', { name: 'Flow · Connect to Flow', exact: true })).toHaveAttribute('href', 'http://127.0.0.1:61228/');
    await open.focus(); await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '关闭本机登录凭据' })).toBeFocused();
    await expect(token).toHaveValue('');
    await page.keyboard.press('Tab'); await expect(load).toBeFocused();
    await page.keyboard.press('Escape'); await expect(open).toBeFocused();
    report.checks.push('empty-by-default; keyboard opening/Tab/Escape/focus return; product href only');

    for (const theme of ['light', 'dark']) {
      await page.getByLabel('主题', { exact: true }).selectOption(theme);
      await page.setViewportSize({ width: 390, height: 844 });
      await open.click();
      assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth));
      await page.screenshot({ path: path.join(outputDirectory, `390-${theme}.png`) });
      await page.keyboard.press('Escape');
    }
    report.checks.push('390 light/dark with fake-only empty credential screenshots; no dialog horizontal overflow');

    await open.click(); await load.click();
    await expect(token).toHaveValue(FAKE_TOKEN); await expect(token).toHaveAttribute('type', 'password');
    assert.equal(reads, 1);
    await dialog.getByRole('button', { name: '复制', exact: true }).click();
    await expect(message).toContainText('已复制');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), FAKE_TOKEN);
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new DOMException('synthetic denial', 'NotAllowedError'); } });
    });
    await dialog.getByRole('button', { name: '复制', exact: true }).click();
    await expect(message).toContainText('无法复制');
    await dialog.getByRole('button', { name: '显示', exact: true }).click();
    await expect(token).toHaveAttribute('type', 'text');
    await dialog.getByRole('button', { name: '隐藏并清除', exact: true }).click();
    await expect(token).toHaveValue(''); await expect(token).toHaveAttribute('type', 'password');
    await expect(dialog.getByRole('button', { name: '复制', exact: true })).toBeDisabled();
    report.checks.push('load masks; native clipboard success; explicit injected clipboard denial; show/hide clears');

    delayNext = true;
    let readDeadline;
    const started = new Promise((resolve, reject) => {
      readDeadline = setTimeout(() => reject(new Error('delayed provider was not entered')), 3000);
      notifyRead = () => { clearTimeout(readDeadline); resolve(); };
    });
    const failed = page.waitForEvent('requestfailed', request => request.url() === `${origin}/api/local-access/owner-token`);
    try { await load.click(); await started; } finally { clearTimeout(readDeadline); }
    await page.keyboard.press('Escape'); await failed;
    releaseRead(); releaseRead = undefined;
    await open.click(); await expect(token).toHaveValue('');
    assert.equal(reads, 2);
    await load.click(); await expect(token).toHaveValue(FAKE_TOKEN);
    assert.equal(reads, 3);
    await page.keyboard.press('Escape'); await expect(token).toHaveValue('');
    report.checks.push('close aborts outstanding read; late response does not restore token; reopen needs explicit load');

    await open.click(); await load.click(); await expect(token).toHaveValue(FAKE_TOKEN);
    const otherPage = await context.newPage(); await otherPage.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
    await expect(token).toHaveValue('');
    await otherPage.close(); await page.bringToFront();
    assert.ok(!JSON.stringify(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(FAKE_TOKEN));
    await page.keyboard.press('Escape');
    report.checks.push('actual hidden page clears; no credential in browser storage');
    assert.deepEqual(report.errors, []);
    report.state = 'PASSED';
  } catch (error) {
    report.state = 'FAILED';
    report.errors.push(error.message);
  } finally {
    releaseRead?.();
    try { await context?.close(); report.cleanup.context = 'closed'; }
    catch { report.cleanup.context = 'failed'; report.state = 'FAILED'; }
    try {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      report.cleanup.http = 'closed';
    } catch { report.cleanup.http = 'failed'; report.state = 'FAILED'; }
    report.credentialReadCount = reads;
    await writeFile(path.join(outputDirectory, 'browser-result.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  throw new Error('Use the isolated browser owner to call checkLocalAccessBrowser; direct execution runs zero checks.');
}
