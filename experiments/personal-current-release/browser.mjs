import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createFixture } from './fixture.mjs';
import { until } from './transport.mjs';
import { BACKEND, sha } from './inventory.mjs';
import { importWebCompatibility, verifyWebCompatibility } from '../../tools/personal-preview/web-release.mjs';
const evidence = resolve(process.argv[2] ?? 'docs/evidence/svc05/run-1');
await mkdir(evidence, { recursive: true });
const fixture = await createFixture(evidence);
let browser;
const input = page => page.getByRole('textbox', { name: 'Message input', exact: true }).filter({ visible: true });
async function connect(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.getByLabel('Owner token', { exact: true }).fill(fixture.token);
  await page.getByRole('button', { name: 'Connect workspace', exact: true }).click(); await expect(input(page)).toBeVisible();
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true }); fixture.report.browser = browser.version();
  for (const preview of fixture.previews) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = [], assets = [], assetReads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { const path = new URL(response.url()).pathname;
      if (response.status() === 200 && /\.(js|css)$/.test(path)) assetReads.push(response.body().then(bytes => assets.push({ path, bytes: bytes.length, sha256: sha(bytes) })));
    });
    const text = `SVC05 ${preview.label} durable message`, draft = `Unsent ${preview.label} draft`;
    try {
      await connect(page, preview.url);
      const html = Buffer.from(await (await fetch(preview.url)).arrayBuffer()); assert.equal(sha(html), preview.manifest.files.find(x=>x.path==='index.html').sha256);
      await page.getByRole('button', { name: 'Execution profile: Runner default', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Execution profile', exact: true });
      await dialog.getByRole('radio', { name: /svc05-synthetic/ }).check(); await page.keyboard.press('Escape');
      await input(page).fill(text); preview.proxy.loseNextTurn(); await page.getByRole('button', { name: 'Send message', exact: true }).filter({ visible: true }).click();
      await expect(input(page)).toHaveValue(''); await input(page).fill(draft);
      const receipt = page.getByRole('region', { name: 'Message receipt', exact: true }); await expect(receipt).toContainText('Receipt unknown'); await expect(input(page)).toHaveValue(draft);
      const first = preview.proxy.records.find(x=>x.dropped); assert.ok(first?.key && first.body); const accepted = first.response, conversationId = accepted.conversation.id, taskId = accepted.turn.task.id;
      const final = await until(()=>fixture.request(`/api/tasks/${taskId}`), value=>value.status==='succeeded'); assert.equal(final.verificationStatus, 'passed');
      await page.getByRole('button', { name: 'Retry same message', exact: true }).click(); await expect(receipt).toHaveCount(0); await expect(input(page)).toHaveValue(draft);
      await expect(page.getByText('SVC05 synthetic reply: ' + text, { exact: true })).toBeVisible();
      const posts = preview.proxy.records.filter(x=>x.method==='POST' && x.path===first.path); assert.equal(posts.length,2); const recovered = posts[1];
      assert.equal(recovered.key,first.key); assert.equal(recovered.body,first.body); assert.equal(recovered.response.replayed,true); assert.equal(recovered.response.turn.id,accepted.turn.id);
      assert.equal((await fixture.request(`/api/conversations/${conversationId}/turns`)).turns.length,1);
      await until(()=>preview.proxy.records, rows=>rows.some(x=>x.path===`/api/tasks/${taskId}` && x.response?.id===taskId));
      const negotiated = preview.proxy.records.find(x=>x.path===`/api/conversations/${conversationId}` && x.forwardedStream==='patch-v1' && x.response?.conversation?.id===conversationId); assert.ok(negotiated); assert.equal(negotiated.response.capabilities.liveAssistantText,true);
      await page.screenshot({ path: join(evidence,preview.label+'-light.png') });
      await page.getByRole('button',{name:'Use dark theme',exact:true}).click(); await page.setViewportSize({width:390,height:844}); await page.screenshot({path:join(evidence,preview.label+'-dark.png')});
      preview.proxy.setLegacy(true); await page.setViewportSize({width:1280,height:800}); await connect(page,preview.url);
      const chats=page.getByRole('button',{name:'Chats',exact:true}); if (!/\bactive\b/.test(await chats.getAttribute('class')??'')) await chats.click();
      await page.getByRole('navigation',{name:'Conversations',exact:true}).getByRole('button',{name:text,exact:true}).click();
      await expect(page.getByText('SVC05 synthetic reply: '+text,{exact:true})).toBeVisible();
      const legacy=preview.proxy.records.findLast(x=>x.path===`/api/conversations/${conversationId}` && !x.forwardedStream && x.response?.conversation?.id===conversationId);assert.ok(legacy);assert.equal(legacy.response.capabilities.liveAssistantText,false);
      const negotiation=await page.evaluate(async ({token,id})=>{
        const denied=await fetch(`/api/conversations/${id}`);const response=await fetch('/api/execution-profiles',{headers:{authorization:`Bearer ${token}`,'X-Flow-Execution-Profile':'steering-v1'}});
        return{denied:denied.status,status:response.status,body:await response.json()};
      },{token:fixture.token,id:conversationId});assert.equal(negotiation.denied,401);assert.equal(negotiation.status,200);assert.ok(negotiation.body.profiles.some(x=>x.reference.id===fixture.profile.reference.id));
      await Promise.all(assetReads);assert.deepEqual(errors,[]);assert.ok(assets.some(x=>x.path.endsWith('.js')));
      for(const asset of assets){const path=preview.manifest.format===2?asset.path.replace(`/__flow_releases/${preview.manifest.releaseId}/`,''):asset.path.slice(1);assert.equal(asset.sha256,preview.manifest.files.find(x=>x.path===path)?.sha256);}
      const observations={
        read:{ownerAuthenticated:negotiation.denied===401,conversationBound:legacy.response.conversation.id===conversationId,taskBound:legacy.response.lastTurn.task.id===taskId},
        send:{acceptedTurnBound:accepted.turn.conversationId===conversationId&&accepted.turn.user.text===text&&accepted.turn.number===1,requestedProfilePreserved:JSON.stringify(accepted.conversation.executionProfile)===JSON.stringify(fixture.profile.reference)},
        recover:{sameKey:first.key===recovered.key,sameBody:first.body===recovered.body,sameTurn:accepted.turn.id===recovered.response.turn.id},
        negotiation:{legacyReadable:legacy.response.capabilities.liveAssistantText===false,streamHeaderHandled:negotiated.response.capabilities.liveAssistantText===true,profileHeaderHandled:negotiation.status===200&&negotiation.body.profiles.some(x=>x.reference.id===fixture.profile.reference.id)},
      };
      const directory=join(evidence,preview.label);await mkdir(directory);const checks={};
      for(const [check,values] of Object.entries(observations)){assert.ok(Object.values(values).every(x=>x===true));const raw=JSON.stringify({format:1,check,backendHead:BACKEND,artifactId:preview.artifact.artifactId,observations:values});checks[check]=sha(raw);await writeFile(join(directory,check+'.json'),raw);}
      await writeFile(join(directory,'report.json'),JSON.stringify({format:1,policy:'flow-web-api-v1',backendHead:BACKEND,artifact:preview.artifact,checks}));
      const compatibilityId=await importWebCompatibility({directory:preview.directory,reportDirectory:directory});await verifyWebCompatibility({directory:preview.directory,artifact:preview.artifact,backendHead:BACKEND,compatibilityId});
      fixture.report.results.push({label:preview.label,artifact:preview.artifact,compatibilityId,observations,conversationId,taskId,bodySha256:sha(first.body),assets,errors});
      await fixture.save(preview.label+'-wire.json',preview.proxy.records);await fixture.save('progress.json',fixture.report);
      console.log(`PASS ${preview.label}: actual App read/send/recover/cap, ${compatibilityId}`);
    }catch(error){await page.screenshot({path:join(evidence,preview.label+'-failure.png')}).catch(()=>{});await fixture.save(preview.label+'-wire-failure.json',preview.proxy.records);throw error;}
    finally{await context.close();}
  }
  assert.equal(fixture.report.results.length,3);fixture.report.outcome='passed';
}catch(error){fixture.report.failure=fixture.redact(error.stack??error);fixture.report.outcome='failed-or-unknown';process.exitCode=1;console.error(fixture.report.failure);}
finally{await browser?.close();await fixture.close();}
