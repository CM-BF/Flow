import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(base ?? '')) throw new Error('Pass own preview origin.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#architecture`);
  await page.locator('#architecture-view').selectOption('modules');
  const sources = [];
  for (const [id, path, text] of [
    ['nextweb', 'apps/web/src/conversations/ConversationThread.tsx', '未开放控件'],
    ['nextbackend', 'plans/flow-001-architecture/plan.md', '后继能力方向'],
  ]) {
    await page.locator(`[data-node=${id}]`).focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator('#architecture-node-content').innerText(), new RegExp(text));
    await page.locator('#architecture-node-content summary').click();
    const href = await page.locator('#architecture-node-content a').getAttribute('href');
    assert.equal(href, `https://github.com/CM-BF/Flow/blob/eb14991a170b72d7d974428b2e440e1faada2c1e/${path}`);
    sources.push({ id, href });
  }
  assert.doesNotMatch(await page.locator('#architecture-canvas').textContent(), /O06|SVC02|K01/);
  await page.locator('#architecture-fit').click();
  await page.screenshot({ path: 'docs/evidence/d06/current/review-fix-modules-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#theme').selectOption('dark');
  await page.locator('#architecture-fit').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'docs/evidence/d06/current/review-fix-modules-dark-narrow.png', fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile('docs/evidence/d06/current/review-fix-browser.json', JSON.stringify({ at: new Date().toISOString(), sourceTarget: '1ca3e5b2be7495042dadcbfdb179e751fb1e90b3', base, passed: true, sources, pageErrors: errors, scope: 'two changed planned nodes, href and supplemental screenshots only; original five-view run not repeated' }, null, 2) + '\n');
} finally { await browser.close(); }
