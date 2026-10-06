import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { FlowApiError } from "@flow/client";
import type { ConversationSnapshot, ConversationTurn, SteeringCommandInput, SteeringCommandResult } from "@flow/contracts";
import { ConversationProjection } from "../src/conversations/projection";
import { userMessageId } from "../src/conversations/messages";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { STEERING_OWNER, STEERING_OPEN, STEERING_ACCEPT, MAX_STEERING_BINDINGS, type SteeringPorts } from "../src/plugin-integration/steering";
import { themes } from "../src/themes";
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
const at="2026-10-06T09:00:00Z";
const turn: ConversationTurn = { id:"turn",conversationId:"chat",number:1,createdAt:at,user:{role:"user",text:"original"},task:{id:"task",title:"Task",harness:"claude",status:"running",verificationStatus:"pending",createdAt:at,updatedAt:at},assistant:{state:"pending",reason:"execution-pending"},effective:{model:null,thinking:"unknown",tools:"unknown",source:null},telemetry:{kind:"execution",taskId:"task",title:"Execution details"} };
const context = { kind:"message" as const,taskId:"task",messageId:userMessageId(turn),role:"user" as const };
function result(input: SteeringCommandInput): SteeringCommandResult { return {replayed:false,command:{id:`command-${input.expectedRevision+1}`,taskId:"task",attemptId:input.attemptId,ownerVersion:input.ownerVersion,nativeSessionId:"native",revision:input.expectedRevision+1,userMessageUuid:"00000000-0000-4000-8000-000000000001",status:"accepted",receiptRevision:0,input:{bytes:Buffer.byteLength(input.text),digest:createHash("sha256").update(input.text).digest("hex")},createdAt:at,updatedAt:at}}; }
function deferred<T>() { let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve}; }
async function setup() {
  const source:ConversationSnapshot={conversation:{id:"chat",title:"Chat",harness:"claude",requested:{model:"runner-default",thinking:"disabled",tools:"configured-readonly"},revision:1,createdAt:at,updatedAt:at},capabilities:{followUp:true,queue:true,steer:false,perTurnModel:false,perTurnThinking:false,perTurnTools:false},nativeSession:null,lastTurn:structuredClone(turn)};
  const port={conversation:vi.fn(async()=>structuredClone(source)),conversationTurns:vi.fn(async()=>({conversation:source.conversation,turns:[structuredClone(source.lastTurn!)],nextCursor:null})),createConversation:vi.fn(),submitConversationTurn:vi.fn(),conversationDetail:vi.fn()};
  const projection=new ConversationProjection(port,"chat",60_000);await projection.refresh();
  let read=true,write=true;
  const admission=vi.fn<SteeringPorts["admission"]>(async()=>({taskId:"task",attemptId:"attempt",ownerVersion:1,revision:0,state:"ready",reason:"ready"}));
  const state=vi.fn<SteeringPorts["state"]>(async()=>({taskId:"task",attemptId:"attempt",revision:0,sealed:false,attemptAvailable:true,commands:[],nextCursor:null}));
  const accept=vi.fn<SteeringPorts["accept"]>(async(_identity,input)=>result(input));
  const actions:AppActions={knowsTask:id=>id==="task",task:()=>null,hasDraft:()=>true,ownsMessage:(task,id,role)=>task==="task"&&id===context.messageId&&role==="user",openTask(){},openWorkspace(){},closeWorkspace(){},async loadReference(){},setTheme(){},async copy(){},steering:{allowed:(_identity,mode)=>mode==="read"?read:write,admission,state,accept}};
  const session=new AppPluginSession(actions,themes[0]!);session.steering.configure("view","route",projection,true);await session.host.activate(STEERING_OWNER);
  cleanups.push(async()=>{projection.dispose();await session.dispose();});
  const open=async(viewKey="view")=>{const value=await session.host.execute(STEERING_OPEN,{viewKey},context);expect(value.ok).toBe(true);const entry=session.steering.getSnapshot().find(e=>e.identity.viewKey===viewKey)!;await vi.waitFor(()=>expect(entry.control.getSnapshot().loading).toBe(false));return entry;};
  return {source,projection,session,admission,state,accept,open,permissions:(r:boolean,w:boolean)=>{read=r;write=w;session.steering.sync();}};
}
async function settled(entry:Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["open"]>>) { await vi.waitFor(()=>expect(entry.control.getSnapshot().receipts.every(r=>r.phase!=="sending")).toBe(true)); }

describe("actual steering host binding",()=>{
  it("registration makes zero reads; only a real current message and explicit P01 open allocate",async()=>{
    const s=await setup();expect(s.admission).not.toHaveBeenCalled();expect(s.session.steering.getSnapshot()).toHaveLength(0);
    expect((await s.session.host.execute(STEERING_OPEN,{viewKey:"foreign"},context)).ok).toBe(false);
    expect((await s.session.host.execute(STEERING_OPEN,{viewKey:"view"},{...context,messageId:"other"})).ok).toBe(false);
    const e=await s.open();expect(s.admission).toHaveBeenCalledTimes(1);expect(s.state).toHaveBeenCalledTimes(1);expect(e.identity.connectionScope).toBe(s.session.id);
    expect((await s.session.host.execute(STEERING_ACCEPT,{entryId:e.id,key:"forged"},context)).ok).toBe(false);expect(s.accept).not.toHaveBeenCalled();
  });
  it("separates host read and write permissions and calls raw write once without recursion",async()=>{
    const s=await setup();s.permissions(true,false);const e=await s.open();expect(e.control.getSnapshot().sendDisabledReason).toContain("write access");expect(await e.control.submit("denied")).toBe(false);expect(s.accept).not.toHaveBeenCalled();
    s.permissions(true,true);await e.control.refresh();expect(await e.control.submit("distinct instruction")).toBe(true);await settled(e);expect(s.accept).toHaveBeenCalledTimes(1);expect(e.control.getSnapshot().receipts[0]?.phase).toBe("accepted");expect(s.session.steering.risks()).toBe(1);
  });
  it("unknown retains original key/body when an ended turn retries and another 4xx cannot erase uncertainty",async()=>{
    const s=await setup();const e=await s.open();s.accept.mockRejectedValueOnce(new FlowApiError(503,"lost","Lost response"));await e.control.submit("frozen instruction");await settled(e);const receipt=e.control.getSnapshot().receipts[0]!;
    s.source.lastTurn!.task.status="succeeded";await s.projection.refresh();expect(await e.control.submit("new forbidden")).toBe(false);
    s.accept.mockRejectedValueOnce(new FlowApiError(409,"attempt_ended","No active attempt"));expect(e.control.retry(receipt.key)).toBe(true);await settled(e);
    expect(e.control.getSnapshot().receipts[0]?.phase).toBe("unknown");expect(s.accept.mock.calls[1]![1]).toEqual(s.accept.mock.calls[0]![1]);expect(s.accept.mock.calls[1]![2]).toBe(s.accept.mock.calls[0]![2]);
  });
  it("hide/disable/offline revoke in-flight ports; restoration keeps receipt and controller without eager reads",async()=>{
    const s=await setup();const e=await s.open(),pending=deferred<SteeringCommandResult>();s.accept.mockReturnValueOnce(pending.promise);await e.control.submit("late");await vi.waitFor(()=>expect(s.accept).toHaveBeenCalledTimes(1));const receipt=e.control.getSnapshot().receipts[0]!;
    s.session.steering.hide("view");expect(s.accept.mock.calls[0]![3].aborted).toBe(true);expect(e.control.getSnapshot().receipts[0]?.phase).toBe("unknown");pending.resolve(result(receipt.input));await Promise.resolve();await Promise.resolve();expect(e.control.getSnapshot().receipts[0]?.phase).toBe("unknown");
    s.session.steering.configure("view","renamed-route",s.projection,true);expect(s.session.steering.getSnapshot()[0]).toBe(e);expect(s.admission).toHaveBeenCalledTimes(1);
    s.projection.setOnline(false);await e.control.refresh();expect(s.admission).toHaveBeenCalledTimes(1);
    s.projection.setOnline(true);await s.projection.refresh();await s.session.host.deactivate(STEERING_OWNER);await e.control.refresh();expect(e.control.getSnapshot().authorized).toBe(false);expect(s.admission).toHaveBeenCalledTimes(1);
    await s.session.host.activate(STEERING_OWNER);expect(s.admission).toHaveBeenCalledTimes(1);await e.control.refresh();expect(s.admission).toHaveBeenCalledTimes(2);
  });
  it("a task ending during local digest invalidates the unsent handoff but preserves the draft contract",async()=>{
    const s=await setup(),e=await s.open(),digest=deferred<ArrayBuffer>();
    const spy=vi.spyOn(crypto.subtle,"digest").mockReturnValueOnce(digest.promise);
    try { const submitting=e.control.submit("still local");expect(e.control.getSnapshot().preparing).toBe(true);
      s.source.lastTurn!.task.status="succeeded";await s.projection.refresh();digest.resolve(new ArrayBuffer(32));
      expect(await submitting).toBe(false);expect(s.accept).not.toHaveBeenCalled();expect(e.control.getSnapshot().receipts).toEqual([]);
    } finally { spy.mockRestore(); }
  });
  it("read revocation aborts pending metadata and late success cannot refresh a new authority generation",async()=>{
    const s=await setup();const e=await s.open();const pending=deferred<Awaited<ReturnType<SteeringPorts["admission"]>>>();s.admission.mockReturnValueOnce(pending.promise);const refreshing=e.control.refresh();await vi.waitFor(()=>expect(s.admission).toHaveBeenCalledTimes(2));s.permissions(false,false);expect(s.admission.mock.calls[1]![2].aborted).toBe(true);
    pending.resolve({taskId:"task",attemptId:"other",ownerVersion:2,revision:0,state:"ready",reason:"ready"});await refreshing;s.permissions(true,true);expect(e.control.getSnapshot().admission?.attemptId).toBe("attempt");expect(e.control.getSnapshot().stale).toBe(true);
  });
  it("bounded visited bindings never silently evict unknown receipts; explicit close releases only that view",async()=>{
    const s=await setup();const first=await s.open();s.accept.mockRejectedValueOnce(Error("lost"));await first.control.submit("unknown");await settled(first);
    for(let i=1;i<MAX_STEERING_BINDINGS;i++){s.session.steering.configure(`view-${i}`,`route-${i}`,s.projection,true);await s.open(`view-${i}`);}
    s.session.steering.configure("ninth","ninth",s.projection,true);expect((await s.session.host.execute(STEERING_OPEN,{viewKey:"ninth"},context)).ok).toBe(false);expect(s.session.steering.getSnapshot()).toHaveLength(8);expect(first.control.getSnapshot().receipts[0]?.phase).toBe("unknown");
    s.session.steering.closeView("view-7");await s.open("ninth");expect(s.session.steering.getSnapshot()).toHaveLength(8);expect(s.session.steering.risks("view")).toBe(1);
  });
  it("session disposal synchronously invalidates old reads/writes before async host cleanup and same IDs start empty",async()=>{
    const s=await setup();const e=await s.open();const pending=deferred<SteeringCommandResult>();s.accept.mockReturnValueOnce(pending.promise);await e.control.submit("old center");await vi.waitFor(()=>expect(s.accept).toHaveBeenCalledTimes(1));const input=s.accept.mock.calls[0]![1];const disposing=s.session.dispose();expect(s.session.signal.aborted).toBe(true);expect(s.accept.mock.calls[0]![3].aborted).toBe(true);expect(s.session.steering.getSnapshot()).toHaveLength(0);pending.resolve(result(input));await disposing;
    const next=await setup();const fresh=await next.open();expect(next.session.id).not.toBe(s.session.id);expect(fresh.control.getSnapshot().receipts).toEqual([]);expect(await e.control.submit("stale handle")).toBe(false);
  });
});
