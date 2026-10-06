import { describe, expect, it } from "vitest";
import type { NativeActivity, NativeActivityReference, NativeActivityPage, TaskSummary } from "@flow/contracts";
import { NativeActivityProjection } from "../src/conversation-activity/native/projection";
const scope = { connectionId: "center", viewId: "pane", conversationId: "conversation", turnId: "turn", taskId: "task" };
const task = { id: "task", updatedAt: "2026-10-06T00:00:00Z", status: "running", verificationStatus: "pending" } as TaskSummary;
const id = (n: number) => n.toString(16).padStart(64, "0");
function row(n = 1): NativeActivityReference { return { id: id(n), activityId: id(n), taskId: "task", attemptId: "attempt", eventId: `event-${n}`, sequence: n, createdAt: task.updatedAt, nativeSessionId: "session", source: "claude.sdk.message", sourceMessageId: `source-${n}`, nativeMessageId: null, blockIndex: 0, parentToolUseId: null, kind: "tool", phase: "input-ready", status: "input-ready", toolUseId: `tool-${n}`, toolName: "Read", detail: { id: `detail-${n}`, title: "Tool input" } }; }
const body = (header: NativeActivityReference): NativeActivity => ({ ...header, body: { content: "{}", mediaType: "application/json", originalBytes: 2, truncated: false, sha256: "a".repeat(64) } });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(pages = [{ activities: [row()], nextCursor: null }] as NativeActivityPage[]) {
  const reads: (string|null)[] = [], bodies: string[] = [];
  const p = new NativeActivityProjection(scope, task, { readPage: async after => { reads.push(after); return pages[after ? 1 : 0]!; }, readBody: async value => { bodies.push(value); return body(pages.flatMap(p => p.activities).find(r => r.id === value)!); } });
  return { p, reads, bodies, pages };
}
describe("native activity displayed-window projection", () => {
  it("does no reads until active, caches body, and resumes without an automatic GET", async () => {
    const s = setup(); expect(s.reads).toEqual([]); s.p.setActive(true); await tick(); expect(s.reads).toEqual([null]); expect(s.bodies).toEqual([]);
    await s.p.loadBody(id(1)); await s.p.loadBody(id(1)); expect(s.bodies).toEqual([id(1)]);
    s.p.setActive(false); s.p.setActive(true); await tick(); expect(s.reads).toHaveLength(1); expect(s.p.getSnapshot().bodies[id(1)]?.data).toBeDefined(); s.p.dispose();
  });
  it("refreshes only current page at its original cursor and leaves other pages stale", async () => {
    const s = setup([{ activities: [row(1)], nextCursor: id(1) }, { activities: [{ ...row(2), attemptId: "retry", sequence: 0 }], nextCursor: null }]);
    s.p.setActive(true); await tick(); expect(s.reads).toHaveLength(1); await s.p.showPage(1); expect(s.reads).toEqual([null,id(1)]);
    s.pages[1]!.activities[0]!.status = "unknown"; s.p.updateTask({ ...task, status: "uncertain", updatedAt: "2026-10-06T00:00:01Z" }); await tick();
    expect(s.reads).toEqual([null,id(1),id(1)]); expect(s.p.getSnapshot().pages[0]!.stale).toBe(true); expect(s.p.getSnapshot().pages[1]!.activities[0]!.status).toBe("unknown");
    await s.p.showPage(0); expect(s.reads.at(-1)).toBe(null); s.p.dispose();
  });
  it("coalesces task updates and never drains nextCursor automatically", async () => {
    const s=setup([{activities:[row()],nextCursor:id(1)}]); s.p.setActive(true); await tick();
    for(let n=1;n<4;n++)s.p.updateTask({...task,updatedAt:`2026-10-06T00:00:0${n}Z`}); await tick(); expect(s.reads).toEqual([null,null]); s.p.setActive(false); s.p.updateTask({...task,status:"succeeded"}); await tick();expect(s.reads).toHaveLength(2);s.p.dispose();
  });
  it("rejects foreign headers, repeated cursors and wrong body identity without caching", async () => {
    const s=setup([{activities:[{...row(),taskId:"foreign"}],nextCursor:null}]);s.p.setActive(true);await tick();expect(s.p.getSnapshot().error).toContain("task");s.p.dispose();
    const p=new NativeActivityProjection(scope,task,{readPage:async()=>({activities:[row()],nextCursor:null}),readBody:async()=>({...body(row()),nativeSessionId:"foreign"})});p.setActive(true);await tick();await p.loadBody(id(1));expect(p.getSnapshot().bodies[id(1)]?.error).toContain("identity");p.dispose();
  });
  it("validates UTF-8 prefix size and metadata, permits truncated invalid JSON as text",async()=>{
    let data=body(row());const p=new NativeActivityProjection(scope,task,{readPage:async()=>({activities:[row()],nextCursor:null}),readBody:async()=>data});p.setActive(true);await tick();
    data={...data,body:{...data.body!,content:"界".repeat(22000),originalBytes:66000}};await p.loadBody(id(1));expect(p.getSnapshot().bodies[id(1)]?.error).toBeTruthy();
    data={...data,body:{...data.body!,content:'{"prefix":',originalBytes:1000,truncated:true}};await p.loadBody(id(1));expect(p.getSnapshot().bodies[id(1)]?.data?.body?.content).toBe('{"prefix":');p.dispose();
  });
  it("ignores late body after hide, settles loading, rejects unloaded IDs",async()=>{
    let resolve!:(v:NativeActivity)=>void;const p=new NativeActivityProjection(scope,task,{readPage:async()=>({activities:[row()],nextCursor:null}),readBody:()=>new Promise(r=>{resolve=r;})});p.setActive(true);await tick();await expect(p.loadBody(id(2))).rejects.toThrow("displayed");const read=p.loadBody(id(1));await tick();p.setActive(false);resolve(body(row()));await read;expect(p.getSnapshot().bodies[id(1)]).toEqual({loading:false});p.setActive(true);expect(p.getSnapshot().bodies[id(1)]?.data).toBeUndefined();p.dispose();
  });
  it("rejects overlapping pages and changed immutable header order atomically",async()=>{
    const s=setup([{activities:[row(1),row(2)],nextCursor:id(2)},{activities:[row(1)],nextCursor:null}]);s.p.setActive(true);await tick();await s.p.showPage(1);expect(s.p.getSnapshot().error).toContain("overlap");expect(s.p.getSnapshot().pages).toHaveLength(1);
    await s.p.showPage(0);s.pages[0]!.activities.reverse();s.pages[0]!.nextCursor=id(1);await s.p.refresh();expect(s.p.getSnapshot().error).toContain("immutable order");expect(s.p.getSnapshot().pages[0]!.activities[0]!.id).toBe(id(1));s.p.dispose();
  });
  it("rejects body source and truncation inconsistencies and can retry after an HTTP failure",async()=>{
    let reply:NativeActivity|Error=Error("HTTP 503");const p=new NativeActivityProjection(scope,task,{readPage:async()=>({activities:[row()],nextCursor:null}),readBody:async()=>{if(reply instanceof Error)throw reply;return reply;}});p.setActive(true);await tick();await p.loadBody(id(1));expect(p.getSnapshot().bodies[id(1)]?.error).toContain("503");
    reply={...body(row()),body:{...body(row()).body!,originalBytes:100,truncated:false}};await p.loadBody(id(1));expect(p.getSnapshot().bodies[id(1)]?.data).toBeUndefined();
    reply=body(row());await p.loadBody(id(1));expect(p.getSnapshot().bodies[id(1)]?.data).toEqual(reply);p.dispose();
  });
  it("a subscriber hiding synchronously during loading prevents the request from starting",async()=>{
    const s=setup();s.p.subscribe(()=>{if(s.p.getSnapshot().loading)s.p.setActive(false);});s.p.setActive(true);await tick();expect(s.reads).toEqual([]);expect(s.p.getSnapshot().loading).toBe(false);s.p.dispose();
  });

});
