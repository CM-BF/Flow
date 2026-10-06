import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const root = fileURLToPath(new URL('..', import.meta.url));
const evidence = fileURLToPath(new URL('../../../docs/evidence/wpf-attach-i01/', import.meta.url));
const files = ['src/attachments/controller.ts','src/attachments/recovery.ts','src/attachments/adapter.ts','src/attachments/AttachmentPicker.tsx','src/attachments/attachments.css','test/attachment-controller.test.ts','test/attachment-recovery.test.ts','test/attachment-input.fixture.tsx','test/attachment-input.browser.ts'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(files.map(async path => [path, createHash('sha256').update(await readFile(`${root}/${path}`)).digest('hex')])));
async function main() {
  const server = await createServer({ root, configFile: false, cacheDir: `${root}/node_modules/.vite-attachment-module`, plugins: [react(), tailwind(), { name: 'attachment-input-entry', configureServer(vite) {
    vite.middlewares.use((request, response, next) => {
      if (new URL(request.url!, 'http://fixture').pathname !== '/') return next();
      response.setHeader('content-type','text/html');
      void vite.transformIndexHtml('/', '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attachment input</title><div id="root"></div><script type="module" src="/test/attachment-input.fixture.tsx"></script></html>').then(html => response.end(html), next);
    });
  } }], server: { host:'127.0.0.1', port:0 }, logLevel:'error' });
  let browser: Browser | undefined, failure: string | null = null;
  const checks: string[] = [], errors: string[] = [], calls: unknown[] = [];
  await server.listen(); const address = server.httpServer!.address(); assert(address && typeof address !== 'string'); const url = `http://127.0.0.1:${address.port}`;
  if (process.argv.includes('--serve')) { console.log(`ATTACHMENT_INPUT_PREVIEW=${url}`); return; }
  try {
    browser = await chromium.launch({ channel:'chrome', headless:true });
    const page = await browser.newPage({ viewport:{width:1100,height:900}, reducedMotion:'reduce' }); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    const draft = () => page.getByPlaceholder('Draft a message…');
    const open = async () => { await page.getByRole('button',{name:'@file · Project files',exact:true}).click(); await expect(page.getByRole('dialog')).toBeVisible(); };
    const close = async () => { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); };
    const count = async (operation:string) => page.evaluate(op => (window as any).attachmentFixture.calls.filter((call:any) => call.operation === op).length, operation);
    const control = async (values:Record<string,unknown>) => page.evaluate(value => Object.assign((window as any).attachmentFixture,value), values);
    const upload = async (name:string,text:string) => { const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button',{name:'Add Attachment',exact:true}).click()]); await chooser.setFiles({name,mimeType:'text/plain',buffer:Buffer.from(text)}); };
    const reset = async () => { await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await expect(draft()).toBeVisible(); };
    const captures = async () => JSON.parse(await page.getByTestId('captures').textContent() || '[]');
    await reset(); assert.equal(await count('capabilities'),0); assert.equal(await count('list'),0);
    await draft().fill('Keep draft'); await open(); assert.equal(await count('list'),0); await page.getByRole('button',{name:'Browse files',exact:true}).click(); await expect(page.getByRole('button',{name:'Use project-1.txt',exact:true})).toBeVisible(); assert.equal(await count('content'),0);
    await page.getByText('Preview project-1.txt',{exact:true}).focus(); await page.keyboard.press('Enter'); await expect(page.locator('.attachment-preview pre')).toContainText('<script>'); assert.equal(await count('content'),1); assert.equal(await page.evaluate(() => (window as any).attachmentInjected),undefined);
    await page.keyboard.press('Space'); await page.keyboard.press('Enter'); assert.equal(await count('content'),1); await page.getByRole('button',{name:'Use project-1.txt',exact:true}).click(); await close(); await expect(draft()).toHaveValue('Keep draft');
    checks.push('Real Thread StrictMode; explicit metadata and keyboard preview 0→1→cache; literal markup escaped; selection preserves draft');
    await page.getByRole('button',{name:'Hide view',exact:true}).click(); const paused = await count('content'); await page.getByRole('button',{name:'Show view',exact:true}).click(); await expect(draft()).toHaveValue('Keep draft'); assert.equal(await count('content'),paused);
    await page.getByRole('button',{name:'Capture draft',exact:true}).click(); await expect.poll(async()=> (await captures()).length).toBe(1); assert.equal((await captures())[0].attachments.length,1); await expect(draft()).toHaveValue('');
    checks.push('Native hidden stops reads and retains protected ready refs; explicit complete-attachment capture has one frozen reference and no body');
    await reset(); await draft().fill('Mention @file'); await draft().press('Tab'); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button',{name:'Browse files',exact:true}).click(); await page.getByRole('button',{name:'Use project-2.txt',exact:true}).click(); await close(); await expect(draft()).toBeFocused(); await expect(draft()).toHaveValue('Mention ');
    await open(); await page.getByRole('button',{name:'Remove project-2.txt',exact:true}).click(); await close(); await expect(page.getByTestId('counts')).toContainText('"items":0');
    checks.push('@file Tab uses existing Dialog focus return; removes only unchanged command token; complete attachment remove synchronizes public composer state without DELETE');
    await reset(); await control({prepareDelay:350}); await upload('upload.txt','\uFEFFFirst line\r\n原文🙂'); await expect.poll(()=>count('upload')).toBe(1); await expect(page.getByRole('button',{name:'Capture draft',exact:true})).toBeEnabled(); await draft().fill('Original send'); await page.getByRole('button',{name:'Capture draft',exact:true}).click(); await page.getByRole('radio',{name:'Queue',exact:true}).check(); await draft().fill('A new draft');
    await expect.poll(async()=> (await captures()).length).toBe(1); const first = (await captures())[0]; assert.equal(first.intent,'send'); assert.equal(first.text,'Original send'); await expect(draft()).toHaveValue('A new draft'); assert.equal(first.attachments.length,1); assert(!JSON.stringify(first).includes('First line'));
    await draft().press('Enter'); await expect.poll(async()=> (await captures()).length).toBe(2); assert.equal((await captures())[1].intent,'queue');
    checks.push('Official add/send preparation delay cannot change click-time Send into Queue or consume newer text; Enter and button share capture; metadata only');
    await reset(); await control({prepareDelay:350}); await upload('held.txt','held original bytes'); await expect(page.getByRole('button',{name:'Capture draft',exact:true})).toBeEnabled(); await draft().fill('Old captured draft'); await page.getByRole('button',{name:'Capture draft',exact:true}).click(); await page.getByRole('button',{name:'Offline',exact:true}).click(); await draft().fill('New offline draft'); await expect(page.getByTestId('held-capture')).toContainText('Old captured draft'); await expect(draft()).toHaveValue('New offline draft'); assert.equal((await captures()).length,0); await page.getByRole('button',{name:'Reconnect',exact:true}).click(); assert.equal((await captures()).length,0);
    checks.push('Readiness change during official async preparation keeps rejected capture separately, never prepends old text or auto-retries after reconnect');
    await reset(); await control({delay:250}); await upload('pending.txt','pending'); await expect(page.getByRole('button',{name:'Capture draft',exact:true})).toBeDisabled(); await draft().fill('Keep pending draft'); await draft().press('Enter'); assert.equal((await captures()).length,0); await page.getByRole('button',{name:'Offline',exact:true}).click(); await page.waitForTimeout(550); await page.getByRole('button',{name:'Reconnect',exact:true}).click(); await expect(draft()).toHaveValue('Keep pending draft'); assert.equal((await captures()).length,0); await expect(page.getByRole('button',{name:'Capture draft',exact:true})).toBeDisabled();
    checks.push('Pending upload blocks button and Enter; offline invalidates ignored-abort late result while keeping text and explicit retry required');
    await reset(); await control({loseNext:true}); await upload('recover.txt','original recovery bytes'); await expect.poll(()=>count('upload')).toBe(1); await open(); await page.getByText('Upload recovery (1)',{exact:true}).click(); await expect(page.getByText('unknown',{exact:true}).last()).toBeVisible(); const original = await page.evaluate(()=> (window as any).attachmentFixture.calls.find((call:any)=>call.operation==='upload'));
    await page.getByRole('button',{name:'Check receipt for recover.txt',exact:true}).click(); await expect(page.getByRole('button',{name:'Use recovered recover.txt',exact:true})).toBeVisible(); assert.equal((await captures()).length,0); await page.getByRole('button',{name:'Forget local record for recover.txt',exact:true}).click(); await expect(page.getByText('Upload recovery (1)',{exact:true})).toHaveCount(0); assert.equal(await count('upload'),1); await close();
    checks.push('Lost acknowledgement preserves journal; explicit lookup finds committed metadata but never auto-attaches or sends; explicit forgetting releases only the known local journal slot');
    await reset(); await control({loseNext:true}); await upload('restart.txt','restart bytes'); await expect.poll(()=>count('upload')).toBe(1); const lost = await page.evaluate(()=> (window as any).attachmentFixture.calls.find((call:any)=>call.operation==='upload')); await page.reload(); await expect(draft()).toBeVisible(); assert.equal(await count('lookup'),0); await open(); await page.getByText('Upload recovery (1)',{exact:true}).click(); await page.getByRole('button',{name:'Check receipt for restart.txt',exact:true}).click(); await expect(page.getByLabel('Reselect original restart.txt')).toBeVisible(); await page.getByLabel('Reselect original restart.txt').setInputFiles({name:'restart.txt',mimeType:'text/plain',buffer:Buffer.from('restart bytes')}); await expect.poll(()=>count('upload')).toBe(1);
    const replay = await page.evaluate(()=> (window as any).attachmentFixture.calls.find((call:any)=>call.operation==='upload')); assert.equal(replay.key,lost.key); assert.deepEqual(replay.request,lost.request); await expect(page.getByRole('button',{name:'Remove restart.txt',exact:true})).toBeVisible();
    const persisted = await page.evaluate(()=>localStorage.getItem('flow-attachment-input-fixture-recovery')); assert(!persisted!.includes('restart bytes')); assert(!persisted!.includes('token')); assert.equal(original.request.name,'recover.txt');
    checks.push('Browser reload restores only bounded nonsecret journal; mock backend reset returns missing receipt yet same key/body after exact file reselection; no draft auto-restore');
    await close(); await page.getByRole('button',{name:'New connection',exact:true}).click(); await expect(page.getByTestId('counts')).toContainText('"items":0'); await draft().fill('New connection draft'); await open(); await page.getByRole('button',{name:'Browse files',exact:true}).click(); await page.getByText('Preview project-1.txt',{exact:true}).click(); await expect(page.locator('.attachment-preview pre').first()).toBeVisible();
    await page.screenshot({path:`${evidence}attachment-light.png`,fullPage:true}); await close(); await page.getByRole('button',{name:'Dark',exact:true}).click(); await page.setViewportSize({width:390,height:844}); await open(); await page.getByText('Preview project-1.txt',{exact:true}).click(); await expect(page.locator('.attachment-preview pre').first()).toBeVisible(); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); await page.screenshot({path:`${evidence}attachment-dark-390.png`,fullPage:true}); await close(); await page.getByRole('button',{name:'Light',exact:true}).click(); await open(); await page.screenshot({path:`${evidence}attachment-light-390.png`,fullPage:true}); await close(); await expect(draft()).toHaveValue('New connection draft');
    checks.push('Connection replacement does not restore selected old refs; 390px light/dark, reduced-motion native controls, keyboard focus and draft preserved');
    await reset(); const transfer = await page.evaluateHandle(()=> { const data = new DataTransfer(); data.items.add(new File(['drag text'],'drop.txt',{type:'text/plain'})); return data; }); await page.locator('[data-slot=aui_composer-shell]').dispatchEvent('drop',{dataTransfer:transfer}); await expect.poll(()=>count('upload')).toBe(1); await transfer.dispose();
    checks.push('Actual official AttachmentDropzone accepts a dragged UTF-8 file through the same adapter');
    assert.deepEqual(errors,[]); calls.push(...await page.evaluate(()=> (window as any).attachmentFixture.calls));
  } catch (error) { failure = error instanceof Error ? error.stack ?? error.message : String(error); throw error; }
  finally {
    try { await writeFile(`${evidence}browser-results.json`,JSON.stringify({generatedAt:new Date().toISOString(),base:'8701a6cf547248e70aa5758f05da1d7d314ae9c0',source:'working tree exact hashes',sourceHashes:await sourceHashes(),url,browser:browser?.version(),checks,errors,failure,lastScenarioCalls:calls,scope:'Official Thread with typed in-memory ports, no HTTP backend/Send/Queue/provider'},null,2)); }
    finally { try { await browser?.close(); } finally { await server.close(); } }
  }
  console.log(`${checks.length} browser groups passed; pageErrors=${errors.length}`);
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
