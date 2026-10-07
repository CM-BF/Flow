import { afterEach, describe, expect, it, vi } from "vitest";
import { FlowClient } from "@flow/client";
import { ConversationProjection } from "../src/conversations/projection";
import { ConversationStreamHost, STREAM_OWNER, STREAM_PANEL } from "../src/conversation-stream/host";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { userMessageId } from "../src/conversations/messages";
import { themes } from "../src/themes";
import { createConversationFixture } from "./conversation.fixture";
import { coreFixture } from "./conversation-message-reuse.probe";
import { installStreamFixture } from "./conversation-stream-integration.fixture";
const cleanups: (()=>Promise<void>)[]=[];
afterEach(async()=>{await Promise.all(cleanups.splice(0).map(close=>close()));});
async function setup(count=1){
 const fixture=createConversationFixture(), stream=installStreamFixture(fixture);fixture.setReplyDelay(600000);
 const tasks=Array.from({length:count},(_,i)=>stream.seed(fixture.chats.get(`chat-${i+1}`)!.turns[0]!));tasks.forEach(task=>stream.append(task,`Draft ${task}`));
 await new Promise<void>(resolve=>fixture.server.listen(0,"127.0.0.1",resolve));const address=fixture.server.address();if(!address||typeof address==="string")throw Error("address");
 const client=new FlowClient({baseUrl:`http://127.0.0.1:${address.port}`,token:"flow-fixture-only",assistantStreamProtocol:"patch-v1"});
 const projections=Array.from({length:count},(_,i)=>new ConversationProjection(client,`chat-${i+1}`,60000));await Promise.all(projections.map(p=>p.refresh()));
 const open=new Set(projections.map((_,i)=>`view-${i}`));
 const actions:AppActions={knowsTask:id=>fixture.tasks.has(id),task:id=>fixture.tasks.get(id)??null,hasDraft:id=>open.has(id),ownsMessage:(task,id,role)=>role==="user"&&projections.some(p=>p.getSnapshot().turns.some(t=>t.task.id===task&&userMessageId(t)===id)),
  stream:{metadata:(identity,options,signal)=>client.assistantStream(identity.taskId,options,signal),patches:(identity,options,signal)=>client.assistantStreamPatches(identity.taskId,options,signal)},
  openTask(){},openWorkspace(){},closeWorkspace(){},async loadReference(){},setTheme(){},async copy(){}};
 const session=new AppPluginSession(actions,themes[0]!);const hosts=projections.map((p,i)=>new ConversationStreamHost(`view-${i}`,p,session.streamAuthority(),session.streamBudget));const detach=hosts.map(host=>host.attach());
 cleanups.push(async()=>{detach.forEach(fn=>fn());hosts.forEach(host=>host.dispose());projections.forEach(p=>p.dispose());await session.dispose();stream.close();await fixture.close();});
 const start=async()=>{await session.host.activate(STREAM_OWNER);hosts.forEach(host=>host.setVisible(true));await vi.waitFor(()=>expect(hosts.every(host=>host.getSnapshot().messages.some(message=>message.metadata?.custom?.flowStream))).toBe(true));};
 return{fixture,stream,client,projections,tasks,open,session,hosts,start};
}
describe("actual conversation stream host",()=>{
 it("Arc FIFO yields complete four-page batches repeatedly to a late third pane under backlog",async()=>{
  const s=await setup(3); s.stream.setDelay(8);
  for(const task of s.tasks) for(let index=0;index<80;index++) s.stream.append(task,` ${index}`);
  await s.session.host.activate(STREAM_OWNER); s.hosts[0]!.setVisible(true);s.hosts[1]!.setVisible(true);
  await vi.waitFor(()=>expect(s.stream.reads.filter(row=>row.kind==="patches").length).toBeGreaterThanOrEqual(2));
  s.hosts[2]!.setVisible(true);
  await vi.waitFor(()=>expect(s.hosts.every(host=>host.getSnapshot().messages.some(message=>JSON.stringify(message.content).includes(" 79")))).toBe(true));
  const pages=s.stream.reads.filter(row=>row.kind==="patches");
  // Each bounded batch is four eight-patch pages. No host begins its third batch
  // before both peers have begun their second, including the late joiner.
  for(const task of s.tasks){
   const third=pages.findIndex(row=>row.taskId===task&&row.after===192);expect(third).toBeGreaterThan(0);
   for(const peer of s.tasks.filter(id=>id!==task))expect(pages.slice(0,third).some(row=>row.taskId===peer&&row.after>=96)).toBe(true);
   expect(pages.filter(row=>row.taskId===task).map(row=>row.after)).toEqual(Array.from({length:11},(_,index)=>index*24));
  }
  expect(s.stream.peak).toBeLessThanOrEqual(2);
  expect(s.hosts.reduce((sum,host)=>sum+host.cached().reduce((bytes,entry)=>bytes+(entry.module.getSnapshot().patches?.totalBytes??0),0),0)).toBeLessThanOrEqual(4*1024*1024);
 });
 it("Arc removes hidden or closed FIFO waiters without retaining a reserved lease",async()=>{
  const s=await setup(3);s.stream.setDelay(35);await s.session.host.activate(STREAM_OWNER);
  s.hosts.forEach(host=>host.setVisible(true));
  await vi.waitFor(()=>expect(s.stream.reads).toHaveLength(2));
  s.hosts[2]!.setVisible(false);
  await vi.waitFor(()=>expect(s.hosts.slice(0,2).every(host=>host.getSnapshot().messages.length===2)).toBe(true));
  expect(s.stream.reads.some(row=>row.taskId===s.tasks[2])).toBe(false);
  s.hosts[2]!.setVisible(true);await vi.waitFor(()=>expect(s.hosts[2]!.getSnapshot().messages.length).toBe(2));
  s.hosts[2]!.dispose();const closed=s.stream.reads.filter(row=>row.taskId===s.tasks[2]).length;
  s.stream.append(s.tasks[0]!," survives waiter removal");await s.projections[0]!.refresh();
  await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages.some(message=>JSON.stringify(message.content).includes("survives waiter removal"))).toBe(true));
  expect(s.stream.reads.filter(row=>row.taskId===s.tasks[2])).toHaveLength(closed);expect(s.stream.peak).toBeLessThanOrEqual(2);
 });
 it("requires independent plugin permission, retains canonical complete state, and has zero inactive reads",async()=>{
  const s=await setup();s.hosts[0]!.setVisible(true);await new Promise(resolve=>setTimeout(resolve,20));expect(s.stream.reads).toEqual([]);
  expect(s.session.host.checkView(STREAM_PANEL,{kind:"global"}).ok).toBe(false);await s.start();expect(s.stream.reads).toHaveLength(2);
  await s.session.host.deactivate(STREAM_OWNER);expect(s.hosts[0]!.getSnapshot().messages.some(m=>m.metadata?.custom?.flowStream)).toBe(false);
  s.stream.finish(s.tasks[0]!,"Final while task running",false);await s.projections[0]!.refresh();
  expect(s.hosts[0]!.getSnapshot().messages.at(-1)?.status).toEqual({type:"complete",reason:"unknown"});expect(s.projections[0]!.getSnapshot().turns[0]?.task.status).toBe("running");expect(s.stream.reads).toHaveLength(2);
 });
 it("updates once per changed input, drains a finite dirty set then stays silent",async()=>{
  const s=await setup();await s.start();const reads=s.stream.reads.length;
  for(let i=0;i<3;i++)await s.projections[0]!.refresh();await new Promise(resolve=>setTimeout(resolve,40));expect(s.stream.reads).toHaveLength(reads);
  s.stream.append(s.tasks[0]!," + next");await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages.some(m=>JSON.stringify(m.content).includes("+ next"))).toBe(true));
  expect(s.stream.reads.filter(r=>r.kind==="patches").map(r=>r.after)).toEqual([0,3]);await new Promise(resolve=>setTimeout(resolve,40));expect(s.stream.reads).toHaveLength(4);
 });
 it("never starts streams for the loaded completed historical turns",async()=>{
  const s=await setup();for(let i=0;i<40;i++)s.fixture.addTurn("chat-1",`historic ${i}`,true);const turn=s.fixture.addTurn("chat-1","current",false),task=s.stream.seed(turn);s.stream.append(task,"Current only");await s.projections[0]!.refresh();await s.start();
  expect(new Set(s.stream.reads.map(r=>r.taskId))).toEqual(new Set([task]));
 });
 it("keeps two visible panes independent and enforces the two-lease connection budget",async()=>{
  const s=await setup(3);s.stream.setDelay(20);await s.start();expect(s.hosts.every(host=>host.getSnapshot().messages.length===2)).toBe(true);expect(s.stream.peak).toBeLessThanOrEqual(2);
  const body=s.hosts[0]!.getSnapshot().messages.at(-1)!;expect(s.session.ownsStreamMessage(s.tasks[0]!,body.id!,"assistant")).toBe(true);expect(s.session.ownsStreamMessage(s.tasks[1]!,body.id!,"assistant")).toBe(false);
  expect(s.session.ownsStreamMessage(s.tasks[0]!,"conversation-stream:invented", "assistant")).toBe(false);
 });
 it("hides and disconnects without new reads, then resumes the cursor without losing composer ownership",async()=>{
  const s=await setup();await s.start();s.hosts[0]!.setVisible(false);s.stream.append(s.tasks[0]!," later");await s.projections[0]!.refresh();expect(s.stream.reads).toHaveLength(2);
  s.hosts[0]!.setVisible(true);await vi.waitFor(()=>expect(s.stream.reads).toHaveLength(4));expect(s.stream.reads.at(-1)?.after).toBe(3);
  s.projections[0]!.setOnline(false);s.stream.append(s.tasks[0]!," offline");s.hosts[0]!.sync();await new Promise(resolve=>setTimeout(resolve,30));expect(s.stream.reads).toHaveLength(4);
  s.projections[0]!.setOnline(true);await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.stream.reads).toHaveLength(6));
 });
 it("disable invalidates late patch results, and reenabling starts from a new authorized cache",async()=>{
  const s=await setup();await s.start();s.stream.setDelay(40);s.stream.append(s.tasks[0]!," late");await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.stream.reads.length).toBeGreaterThan(2));
  await s.session.host.deactivate(STREAM_OWNER);await new Promise(resolve=>setTimeout(resolve,70));expect(s.hosts[0]!.getSnapshot().messages.some(m=>m.metadata?.custom?.flowStream)).toBe(false);
  s.stream.setDelay(0);await s.session.host.activate(STREAM_OWNER);await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages.some(m=>JSON.stringify(m.content).includes("late"))).toBe(true));
 });
 it("replaces only settled drafts and keeps a canonical final explicitly complete while task remains running",async()=>{
  const s=await setup();await s.start();s.stream.append(s.tasks[0]!,"","block-complete");s.stream.finish(s.tasks[0]!,"Complete canonical");await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages).toHaveLength(2));
  const final=s.hosts[0]!.getSnapshot().messages.at(-1)!;expect(final.content).toEqual([{type:"text",text:"Complete canonical"}]);expect(final.status).toEqual({type:"complete",reason:"unknown"});
 });
 it("capability false and expired connection never start or accept stream reads",async()=>{
  const s=await setup();s.stream.setCapability(false);await s.projections[0]!.refresh();await s.session.host.activate(STREAM_OWNER);s.hosts[0]!.setVisible(true);await new Promise(resolve=>setTimeout(resolve,20));expect(s.stream.reads).toEqual([]);
  s.stream.setCapability(true);s.stream.setDelay(40);await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.stream.reads.length).toBeGreaterThan(0));await s.session.dispose();await new Promise(resolve=>setTimeout(resolve,60));expect(s.hosts[0]!.getSnapshot().messages.some(m=>m.metadata?.custom?.flowStream)).toBe(false);
 });
 it("bounds view and connection turn caches while keeping canonical conversation history",async()=>{
  const s=await setup(3);await s.start();
  for(let i=0;i<6;i++)for(let view=0;view<3;view++){
   const turn=s.fixture.addTurn(`chat-${view+1}`,`next ${i}`,false),task=s.stream.seed(turn);s.stream.append(task,`body ${i}`);await s.projections[view]!.refresh();
   await vi.waitFor(()=>expect(s.hosts[view]!.getSnapshot().messages.some(m=>JSON.stringify(m.content).includes(`body ${i}`))).toBe(true));
   expect(s.hosts[view]!.cached().length).toBeLessThanOrEqual(4);expect(s.hosts.reduce((n,h)=>n+h.cached().length,0)).toBeLessThanOrEqual(8);
   for(const host of s.hosts){expect(host.getSnapshot().states.size).toBe(host.cached().length);const liveIds=new Set(host.cached().map(e=>e.identity.turnId));for(const member of host.getSnapshot().members.values())if(member.draft)expect(liveIds.has(member.turnId)).toBe(true);}
  }
  expect(s.hosts.some(h=>h.getSnapshot().evicted)).toBe(true);expect(s.hosts.every(h=>h.getSnapshot().messages.filter(m=>m.role==="user").length===7)).toBe(true);
 });
 it("bounds failures across changing host inputs and resumes only on explicit Retry",async()=>{
  const s=await setup();await s.start();s.stream.setFailure(true);
  for(let i=0;i<4;i++){s.stream.append(s.tasks[0]!,` ${i}`);await s.projections[0]!.refresh();await new Promise(resolve=>setTimeout(resolve,30));}
  expect(s.stream.reads).toHaveLength(5);expect(s.hosts[0]!.getSnapshot().states.values().next().value?.error).toBeTruthy();
  s.stream.setFailure(false);const turn=s.projections[0]!.getSnapshot().turns[0]!;s.hosts[0]!.retry(turn.id);await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages.some(m=>JSON.stringify(m.content).includes("0 1 2 3"))).toBe(true));
 });

 it("reconciles the actual official runtime repository without phantom branches or retained evicted bodies",async()=>{
  const s=await setup(3);await s.start();const core=await coreFixture([...s.hosts[0]!.getSnapshot().messages]);
  const apply=()=>core.update([],{messages:undefined,convertMessage:undefined,messageRepository:s.hosts[0]!.getSnapshot().repository,isRunning:true});
  const assertExact=()=>{apply();expect(core.thread.export().messages.map(item=>item.message.id).sort()).toEqual(s.hosts[0]!.getSnapshot().messages.map(m=>m.id).sort());};
  core.thread.composer.setText("Independent composer draft");assertExact();const originalUser=core.thread.messages[0];
  for(let i=0;i<3;i++){await s.session.host.deactivate(STREAM_OWNER);assertExact();expect(core.thread.export().messages).toHaveLength(1);await s.session.host.activate(STREAM_OWNER);await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages.length).toBe(2));assertExact();expect(core.thread.messages[0]).toBe(originalUser);}
  s.stream.append(s.tasks[0]!,"","block-complete");s.stream.finish(s.tasks[0]!,"Canonical after draft");await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages).toHaveLength(2));assertExact();expect(core.thread.export().messages).toHaveLength(2);expect(core.thread.messages.at(-1)?.status).toEqual({type:"complete",reason:"unknown"});expect(core.thread.isRunning).toBe(true);
  const pending=s.fixture.addTurn("chat-1","Draft to evict",false),pendingTask=s.stream.seed(pending);s.stream.append(pendingTask,"Evict this runtime draft");await s.projections[0]!.refresh();await vi.waitFor(()=>expect(s.hosts[0]!.getSnapshot().messages.some(m=>JSON.stringify(m.content).includes("Evict this runtime draft"))).toBe(true));assertExact();s.hosts[0]!.setVisible(false);
  // Fill other panes: cross-host eviction must also remove the victim's public runtime body.
  for(let i=0;i<4;i++)for(const view of [1,2]){const turn=s.fixture.addTurn(`chat-${view+1}`,`evict ${i}`,false),task=s.stream.seed(turn);s.stream.append(task,`other ${i}`);await s.projections[view]!.refresh();await vi.waitFor(()=>expect(s.hosts[view]!.getSnapshot().messages.some(m=>JSON.stringify(m.content).includes(`other ${i}`))).toBe(true));}
  assertExact();expect(JSON.stringify(core.thread.export())).not.toContain("Evict this runtime draft");expect(core.thread.composer.text).toBe("Independent composer draft");expect(core.thread.capabilities.switchToBranch).toBe(false);
 });

});
