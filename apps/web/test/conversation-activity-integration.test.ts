import { afterEach, describe, expect, it } from "vitest";
import { FlowClient } from "@flow/client";
import type { NativeActivityReference } from "@flow/contracts";
import { ConversationProjection } from "../src/conversations/projection";
import { userMessageId } from "../src/conversations/messages";
import { createConversationActivityBindings, ACTIVITY_OWNER, ACTIVITY_PANEL, type ActivityReaders } from "../src/plugin-integration/activity";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { themes } from "../src/themes";
import { createConversationFixture } from "./conversation.fixture";
const cleanups: (()=>Promise<void>)[]=[];
afterEach(async()=>{await Promise.all(cleanups.splice(0).map(fn=>fn()));});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function setup(){
 const fixture=createConversationFixture();fixture.addTurn("chat-2","second",true);
 await new Promise<void>(resolve=>fixture.server.listen(0,"127.0.0.1",resolve));const address=fixture.server.address();if(!address||typeof address==="string")throw Error("fixture");
 const client=new FlowClient({baseUrl:`http://127.0.0.1:${address.port}`,token:"flow-fixture-only"});
 const projections=["chat-1","chat-2"].map(id=>new ConversationProjection(client,id,60000));await Promise.all(projections.map(p=>p.refresh()));
 const reads:string[]=[], open=new Set(["a","b"]);const headers=new Map<string,NativeActivityReference>();
 for(const [i,p]of projections.entries()){const t=p.getSnapshot().turns[0]!;const id=(i+1).toString().repeat(64);headers.set(t.task.id,{id,activityId:id,taskId:t.task.id,attemptId:"attempt",eventId:`event-${i}`,sequence:0,createdAt:t.task.createdAt,nativeSessionId:"native",source:"claude.sdk.message",sourceMessageId:`source-${i}`,nativeMessageId:null,blockIndex:0,parentToolUseId:null,kind:"tool",phase:"input-ready",toolUseId:`tool-${i}`,toolName:"Read",status:"input-ready",detail:{id:`detail-${i}`,title:"Tool input"}});}
 const activity:ActivityReaders={events:async(identity,after)=>{reads.push(`events:${identity.taskId}`);return client.events(identity.taskId,after);},detail:async(identity,id,signal)=>{reads.push(`detail:${id}`);return client.conversationDetail(identity.conversationId,identity.turnId,id,signal);},nativePage:async identity=>{reads.push(`native:${identity.taskId}`);return{activities:[headers.get(identity.taskId)!],nextCursor:null};},nativeBody:async(identity,id)=>{reads.push(`body:${id}`);return{...headers.get(identity.taskId)!,body:{content:"{}",mediaType:"application/json",originalBytes:2,truncated:false,sha256:"a".repeat(64)}};}};
 const actions:AppActions={activity,knowsTask:id=>fixture.tasks.has(id),task:id=>fixture.tasks.get(id)??null,hasDraft:id=>open.has(id),ownsMessage:(task,id,role)=>role==="user"&&projections.some(p=>p.getSnapshot().turns.some(t=>t.task.id===task&&userMessageId(t)===id)),openTask(){},openWorkspace(){},closeWorkspace(){},async loadReference(){},setTheme(){},async copy(){}};
 const session=new AppPluginSession(actions,themes[0]!);const bindings=projections.map((p,i)=>createConversationActivityBindings(session,i?"b":"a",p));
 const bind=(i:number)=>bindings[i]!.bind(userMessageId(projections[i]!.getSnapshot().turns[0]!))!;
 cleanups.push(async()=>{bindings.forEach(b=>b.dispose());projections.forEach(p=>p.dispose());await session.dispose();await fixture.close();});
 return{fixture,projections,session,bindings,bind,reads,open,headers,activity};
}
describe("conversation activity host bridge",()=>{
 it("registers genuine button/menu/panel without any reads and expands lazily",async()=>{
  const s=await setup();s.bindings[0]!.setVisible(true);await s.session.host.activate(ACTIVITY_OWNER);expect(s.reads).toEqual([]);
  const contributions=s.session.host.getSlotSnapshot("chat.message.footer");expect(contributions.map(c=>c.declaration.kind).sort()).toEqual(["button","menu","panel"]);
  const e=s.bind(0);e.setDisplay(true,"native");await tick();expect(s.reads).toEqual([`native:${e.identity.taskId}`]);await e.native.loadBody(s.headers.get(e.identity.taskId)!.id);await e.native.loadBody(s.headers.get(e.identity.taskId)!.id);expect(s.reads.filter(r=>r.startsWith("body"))).toHaveLength(1);
 });
 it("allows both split panes while global navigation focuses only one",async()=>{
  const s=await setup();await s.session.host.activate(ACTIVITY_OWNER);s.bindings.forEach(b=>b.setVisible(true));const a=s.bind(0),b=s.bind(1);
  s.session.publishNavigation({activeTaskId:b.identity.taskId,workspaceTab:"files",workspaceOpen:false},{kind:"task",taskId:b.identity.taskId});a.setDisplay(true,"native");b.setDisplay(true,"native");await tick();expect(s.reads).toEqual([`native:${a.identity.taskId}`,`native:${b.identity.taskId}`]);
  expect(s.bindings[0]!.bind(b.identity.messageId)).toBeNull();
 });
 it("native hide is zero-read, resume retains cache, and collapsed updates do not poll",async()=>{
  const s=await setup();await s.session.host.activate(ACTIVITY_OWNER);s.bindings[0]!.setVisible(true);const e=s.bind(0);e.setDisplay(true,"native");await tick();await e.native.loadBody(s.headers.get(e.identity.taskId)!.id);
  s.bindings[0]!.setVisible(false);s.bindings[0]!.setVisible(true);await tick();expect(s.reads).toHaveLength(2);e.setDisplay(false,"native");
  const turn=s.fixture.chats.get("chat-1")!.turns[0]!;turn.task.updatedAt="2026-10-06T12:00:00Z";await s.projections[0]!.refresh();s.bindings[0]!.sync();await tick();expect(s.reads).toHaveLength(2);e.setDisplay(true,"native");await tick();expect(s.reads).toHaveLength(3);
 });
 it("disable, close and session disposal reject existing ports and late responses",async()=>{
  const s=await setup();await s.session.host.activate(ACTIVITY_OWNER);s.bindings[0]!.setVisible(true);const e=s.bind(0);e.setDisplay(true,"native");await tick();
  await s.session.host.deactivate(ACTIVITY_OWNER);await e.native.refresh();expect(e.native.getSnapshot().error).toContain("authorized");expect(s.reads).toHaveLength(1);
  await s.session.host.activate(ACTIVITY_OWNER);s.open.delete("a");await e.native.refresh();expect(s.reads).toHaveLength(1);s.open.add("a");
  let resolve!:(value:Awaited<ReturnType<ActivityReaders["nativeBody"]>>)=>void;s.activity.nativeBody=()=>new Promise(r=>{resolve=r;});const pending=e.native.loadBody(s.headers.get(e.identity.taskId)!.id);await tick();const disposed=s.session.dispose();resolve({...s.headers.get(e.identity.taskId)!,body:null});await pending;await disposed;expect(e.native.getSnapshot().bodies[s.headers.get(e.identity.taskId)!.id]?.data).toBeUndefined();
 });
 it("task events stay separate from native routes and only expand the selected source",async()=>{
  const s=await setup();await s.session.host.activate(ACTIVITY_OWNER);s.bindings[0]!.setVisible(true);const e=s.bind(0);e.setDisplay(true,"events");await e.generic.refresh();expect(s.reads).toEqual([`events:${e.identity.taskId}`]);expect(e.generic.getSnapshot().entries.length).toBeGreaterThan(0);
  expect(s.session.host.checkView(ACTIVITY_PANEL,{kind:"global"}).ok).toBe(false);
 });
 it("offline with unchanged turns blocks native/events/body and reconnect restores an open view",async()=>{
  const s=await setup();await s.session.host.activate(ACTIVITY_OWNER);s.bindings[0]!.setVisible(true);const e=s.bind(0),turns=s.projections[0]!.getSnapshot().turns;
  s.projections[0]!.setOnline(false);expect(s.projections[0]!.getSnapshot().turns).toBe(turns);s.bindings[0]!.sync();e.setDisplay(true,"native");await tick();expect(s.reads).toEqual([]);expect(e.native.getSnapshot().active).toBe(false);
  e.setDisplay(true,"events");await tick();expect(s.reads).toEqual([]);expect(e.generic.getSnapshot().online).toBe(false);
  e.setDisplay(true,"native");s.projections[0]!.setOnline(true);await s.projections[0]!.refresh();s.bindings[0]!.sync();await tick();expect(s.reads).toEqual([`native:${e.identity.taskId}`]);
  await e.native.loadBody(s.headers.get(e.identity.taskId)!.id);const before=s.reads.length;s.projections[0]!.setOnline(false);s.bindings[0]!.sync();await e.native.loadBody(s.headers.get(e.identity.taskId)!.id);expect(s.reads).toHaveLength(before);s.bindings[0]!.setVisible(false);s.projections[0]!.setOnline(true);await s.projections[0]!.refresh();s.bindings[0]!.sync();await tick();expect(s.reads).toHaveLength(before);
 });
 it("going offline aborts a body signal and drops its late result without losing settled cache",async()=>{
  const s=await setup();await s.session.host.activate(ACTIVITY_OWNER);s.bindings[0]!.setVisible(true);const e=s.bind(0);e.setDisplay(true,"native");await tick();
  let signal!:AbortSignal,resolve!:(value:Awaited<ReturnType<ActivityReaders["nativeBody"]>>)=>void;s.activity.nativeBody=(_i,_id,received)=>{signal=received;return new Promise(r=>{resolve=r;});};const pending=e.native.loadBody(s.headers.get(e.identity.taskId)!.id);await tick();
  const turns=s.projections[0]!.getSnapshot().turns;s.projections[0]!.setOnline(false);expect(s.projections[0]!.getSnapshot().turns).toBe(turns);s.bindings[0]!.sync();expect(signal.aborted).toBe(true);resolve({...s.headers.get(e.identity.taskId)!,body:null});await pending;expect(e.native.getSnapshot().bodies[s.headers.get(e.identity.taskId)!.id]).toEqual({loading:false});
 });

});
