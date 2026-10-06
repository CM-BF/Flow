import {afterEach,expect,test} from 'vitest';
import {FlowClient} from '@flow/client';
import {createInteractionController,observationPage,type InteractionController} from '@flow/interaction';
import {streamCenter} from '../test-fixtures/stream-center.js';
const close:(()=>Promise<void>)[]=[];
afterEach(async()=>{for(const fn of close.splice(0).reverse())await fn();});
async function setup() {
  const fixture=await streamCenter();close.push(()=>fixture.close());fixture.append('First');
  const client=new FlowClient({baseUrl:fixture.url,token:'synthetic-owner',assistantStreamProtocol:'patch-v1'});
  const controller=createInteractionController({client,observe:client,connectionId:'synthetic-center',pollMs:100,intents:{load:async()=>null,save:async()=>{},clear:async()=>{}}});close.push(()=>controller.dispose());await controller.initialize();
  return {fixture,controller,async open(){expect((await controller.input('/open '+fixture.conversation.id)).ok).toBe(true);}};
}
const texts=(c:InteractionController)=>c.snapshot().observation?.segments.map(s=>s.text);
test('HTTP observation grows twice using cursor patches, then only explicit settlement replaces the draft',async()=>{
  const {fixture,controller,open}=await setup();await open();await expect.poll(()=>texts(controller)).toEqual(['First']);
  fixture.append(' 中文🙂');await expect.poll(()=>texts(controller)).toEqual(['First 中文🙂']);
  fixture.append(' third');await expect.poll(()=>texts(controller)).toEqual(['First 中文🙂 third']);
  expect(fixture.calls.filter(c=>c.url.includes('/native-activities/')||c.url.includes('/details/'))).toEqual([]);
  expect(fixture.calls.filter(c=>c.url.includes('/patches')).map(c=>new URL(c.url,fixture.url).searchParams.get('after'))).toContain('1');
  fixture.finish();await expect.poll(()=>texts(controller)).toEqual(['Canonical final']);
  expect(controller.snapshot().observation?.segments[0]).toMatchObject({kind:'final',taskStatus:'succeeded'});
  expect(fixture.calls.find(c=>c.url==='/api/conversations/'+fixture.conversation.id)?.protocol).toBe('patch-v1');
});
test('activity headers stay lazy, redaction issues no body request, and bounded fragments remain visibly truncated',async()=>{
  const {fixture,controller,open}=await setup();await open();await controller.input('/activity');
  expect(controller.snapshot().observation?.activities).toHaveLength(6);
  expect(fixture.calls.filter(c=>c.url.includes('/native-activities/'))).toHaveLength(0);
  expect((await controller.input('/detail 2')).ok).toBe(true);expect(fixture.calls.filter(c=>c.url.includes('/native-activities/'))).toHaveLength(0);
  expect((await controller.input('/detail 1')).ok).toBe(true);expect(controller.snapshot().observation?.detail).toMatchObject({truncated:true,text:'\u001b]52;c;UNTRUSTED\u0007 {"path":"synthetic"'});
  await controller.input('/detail 1');expect(fixture.calls.filter(c=>c.url.includes('/native-activities/'))).toHaveLength(1);
  await controller.input('/back');expect(controller.snapshot().observation?.detail).toBeNull();
});
test('mismatched loaded activity identity is rejected and never cached',async()=>{
  const {fixture,controller,open}=await setup();await open();await controller.input('/activity');fixture.setBadBody(true);
  expect((await controller.input('/detail 1')).ok).toBe(false);expect(controller.snapshot().observation?.detail).toBeNull();
  fixture.setBadBody(false);expect((await controller.input('/detail 1')).ok).toBe(true);
  expect(fixture.calls.filter(c=>c.url.includes('/native-activities/'))).toHaveLength(2);
});
test('disconnect while a body is in flight rejects its late response; work and saved raw stream remain separate',async()=>{
  const {fixture,controller,open}=await setup();await open();await expect.poll(()=>texts(controller)).toEqual(['First']);await controller.input('/activity');fixture.holdBody();
  const reading=controller.input('/detail 1');await expect.poll(()=>fixture.calls.filter(c=>c.url.includes('/native-activities/')).length).toBe(1);
  controller.disconnect();fixture.releaseBody();expect((await reading).ok).toBe(false);expect(controller.snapshot().observation?.detail).toBeNull();
  const count=fixture.calls.length;fixture.finish();await new Promise(done=>setTimeout(done,160));expect(fixture.calls).toHaveLength(count);expect(fixture.turn.task.status).toBe('succeeded');
  expect((await controller.input('/recover')).ok).toBe(true);await expect.poll(()=>texts(controller)).toEqual(['Canonical final']);
});
test('old capability stays final-only without touching stream endpoints',async()=>{
  const {fixture,controller,open}=await setup();fixture.setCapability(false);fixture.finish('Old center reply');await open();
  expect(texts(controller)).toEqual(['Old center reply']);expect(fixture.calls.some(c=>c.url.includes('/assistant-stream'))).toBe(false);
});
test('missing patch history preserves verified text and reports a gap instead of completion',async()=>{
  const {fixture,controller,open}=await setup();await open();await expect.poll(()=>texts(controller)).toEqual(['First']);fixture.setBrokenPatches(true);fixture.append(' missing');
  await expect.poll(()=>controller.snapshot().observation?.error).toContain('not reached');expect(texts(controller)).toEqual(['First']);
  expect(controller.snapshot().observation?.segments[0]?.phase).toBe('streaming');
});
test('only four loaded bodies are cached and final details require the bound route/reference',async()=>{
  const {fixture,controller,open}=await setup();await open();await controller.input('/activity');
  for(const n of [1,3,4,5,6,1])expect((await controller.input('/detail '+n)).ok).toBe(true);
  expect(fixture.calls.filter(c=>c.url.includes('/native-activities/'))).toHaveLength(6);
  fixture.finish('Complete reply');await expect.poll(()=>controller.snapshot().turns[0]?.assistant.state).toBe('available');fixture.setBadReply(true);
  expect((await controller.input('/reply')).ok).toBe(false);fixture.setBadReply(false);expect((await controller.input('/reply')).ok).toBe(true);
  expect(fixture.calls.some(c=>c.url===`/api/conversations/${fixture.conversation.id}/turns/${fixture.turn.id}/details/${fixture.turn.assistant.state==='available'?fixture.turn.assistant.contentRef.id:''}`)).toBe(true);
});

test('full final detail cannot override a verified nontruncated preview with different bytes',async()=>{
  const {fixture,controller,open}=await setup();fixture.finish('Expected canonical body');await open();fixture.setBadContent(true);
  expect((await controller.input('/reply')).ok).toBe(false);expect(controller.snapshot().observation?.detail).toBeNull();
});

test('long assistant text stays bounded on screen and earlier pages remain explicitly readable',async()=>{
  const {fixture,controller,open}=await setup();fixture.append('x'.repeat(5000));await open();await expect.poll(()=>texts(controller)?.[0]?.length).toBe(5005);
  const latest=observationPage(controller.snapshot().observation!);expect(latest.page).toBe(3);expect(latest.segments[0]?.text.length).toBe(1005);
  expect((await controller.input('/page 1')).ok).toBe(true);expect(observationPage(controller.snapshot().observation!).segments[0]?.text.startsWith('First')).toBe(true);
  expect((await controller.input('/page 4')).ok).toBe(false);await controller.input('/back');expect(observationPage(controller.snapshot().observation!).page).toBe(3);
});

test('task changes mark opened activity as stale until an explicit bounded page refresh',async()=>{
  const {fixture,controller,open}=await setup();await open();await controller.input('/activity');fixture.activities[0]!.status='unknown';fixture.append(' changed');fixture.turn.task.status='cancelled';
  await expect.poll(()=>controller.snapshot().observation?.activityStale).toBe(true);
  expect(controller.snapshot().observation?.activities[0]?.status).toBe('input-ready');
  expect(fixture.calls.filter(c=>new URL(c.url,fixture.url).pathname.endsWith('/native-activities'))).toHaveLength(1);
  await controller.input('/activity');expect(controller.snapshot().observation?.activities[0]?.status).toBe('unknown');expect(controller.snapshot().observation?.activityStale).toBe(false);
});
