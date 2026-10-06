import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationSnapshot, KnowledgeResolved } from "@flow/contracts";
import { ConversationProjection } from "../src/conversations/projection";
import { AppPluginSession, type AppActions } from "../src/plugin-integration/session";
import { KNOWLEDGE_OWNER, KNOWLEDGE_PANEL } from "../src/plugin-integration/knowledge";
import { ConversationProjects } from "../src/conversation-context/projects";
import { citationKey } from "../src/conversation-context/selection";
import { themes } from "../src/themes";
import { contextHit, contextText } from "./conversation-context-integration.fixture";
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.useRealTimers(); });
const at = "2026-10-06T08:00:00Z";
async function setup() {
  const source: ConversationSnapshot = { conversation: { id: "chat", title: "Chat", projectId: "project-01", harness: "claude", requested: { model: "runner-default", thinking: "disabled", tools: "configured-readonly" }, revision: 0, createdAt: at, updatedAt: at }, capabilities: { followUp: true, queue: false, knowledgeContext: true, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, nativeSession: null, lastTurn: null };
  const port = { conversation: vi.fn(async () => structuredClone(source)), conversationTurns: vi.fn(async () => ({ conversation: source.conversation, turns: [], nextCursor: null })), createConversation: vi.fn(), submitConversationTurn: vi.fn(), conversationDetail: vi.fn() };
  const projection = new ConversationProjection(port,"chat",60_000); await projection.refresh();
  const search = vi.fn(async () => ({ hits: [contextHit()], hasMore: false }));
  const resolve = vi.fn(async (): Promise<KnowledgeResolved> => ({ citation: contextHit().citation, text: contextText, isCurrent: true, currentVersion: 1 }));
  const projects = vi.fn(async () => ({ projects: [], nextCursor: null }));
  let valid = true;
  const actions: AppActions = { knowsTask: () => false, task: () => null, hasDraft: id => valid && ["route-a","route-b"].includes(id), openTask(){}, openWorkspace(){}, closeWorkspace(){}, async loadReference(){}, setTheme(){}, async copy(){}, knowledge: { current: identity => valid && identity.conversationId === "chat" && identity.projectId === "project-01", search, resolve, projects } };
  const session = new AppPluginSession(actions,themes[0]!);
  const binding = session.knowledgeBinding("stable-view",projection); binding.configure("route-a",true); await session.host.activate(KNOWLEDGE_OWNER); binding.open();
  const controller = binding.getSnapshot().controller!;
  cleanups.push(async () => { projection.dispose(); await session.dispose(); });
  return { source, port, projection, session, binding, controller, search, resolve, projects, revoke: () => { valid=false; binding.sync(); } };
}
describe("knowledge actual chat binding", () => {
  it("uses P01 button and typed panel, no registration reads and no global context access", async () => {
    const s = await setup(); expect(s.search).not.toHaveBeenCalled(); expect(s.resolve).not.toHaveBeenCalled();
    expect(s.session.host.getSlotSnapshot("chat.composer.actions").some(item => item.declaration.id === "flow.conversation-knowledge.button")).toBe(true);
    expect(s.session.host.checkView(KNOWLEDGE_PANEL,{kind:"global"}).ok).toBe(false);
    await s.controller.search("fixed"); s.controller.add(contextHit().citation); expect(s.resolve).not.toHaveBeenCalled();
    s.binding.close(); expect(s.binding.capture().knowledge).toHaveLength(1); await s.controller.search("closed"); expect(s.search).toHaveBeenCalledTimes(1);
  });
  it("selected-array generation protects remove/reselect and body updates do not invalidate a handoff", async () => {
    const s=await setup(); await s.controller.search("fixed"); s.controller.add(contextHit().citation);
    const old=s.binding.capture();s.controller.remove(contextHit().citation);s.controller.add(contextHit().citation);s.binding.consume(old);expect(s.controller.freeze()).toHaveLength(1);
    const current=s.binding.capture();await s.controller.expand(contextHit().citation);s.binding.consume(current);expect(s.controller.freeze()).toEqual([]);expect(current.knowledge).toHaveLength(1);
    s.controller.add(contextHit().citation);s.binding.consume(current);expect(s.controller.freeze()).toHaveLength(1);
  });
  it("hidden/offline/disabled block reads and late writes while references and cache survive restoration", async () => {
    const s=await setup();await s.controller.search("fixed");s.controller.add(contextHit().citation);await s.controller.expand(contextHit().citation);
    s.binding.configure("route-a",false);await s.controller.search("hidden");await s.controller.expand(contextHit().citation,{refresh:true});expect(s.search).toHaveBeenCalledTimes(1);expect(s.resolve).toHaveBeenCalledTimes(1);
    s.binding.configure("route-a",true);s.projection.setOnline(false);await s.controller.search("offline");expect(s.search).toHaveBeenCalledTimes(1);
    s.projection.setOnline(true);await s.projection.refresh();await s.session.host.deactivate(KNOWLEDGE_OWNER);await s.controller.search("disabled");expect(s.search).toHaveBeenCalledTimes(1);expect(()=>s.binding.capture()).toThrow();
    await s.session.host.activate(KNOWLEDGE_OWNER);s.binding.open();expect(s.binding.capture().knowledge).toHaveLength(1);await s.controller.expand(contextHit().citation);expect(s.resolve).toHaveBeenCalledTimes(1);
    let release!:(value:KnowledgeResolved)=>void;s.resolve.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const pending=s.controller.expand(contextHit().citation,{refresh:true});await Promise.resolve();await Promise.resolve();s.binding.configure("route-a",false);release({citation:contextHit().citation,text:contextText,isCurrent:false,currentVersion:2});await pending;
    expect(s.controller.getSnapshot().bodies[citationKey(contextHit().citation)]?.data?.currentVersion).toBe(1);
  });
  it("route rename keeps stable selection while revoked and closed session reject old ports",async()=>{
    const s=await setup();await s.controller.search("fixed");s.controller.add(contextHit().citation);s.binding.configure("route-b",true);
    expect(s.session.knowledgeBinding("stable-view",s.projection)).toBe(s.binding);expect(s.binding.capture().knowledge).toHaveLength(1);
    s.revoke();await s.controller.search("revoked");expect(s.search).toHaveBeenCalledTimes(1);expect(()=>s.binding.capture()).toThrow();
    await s.session.dispose();expect(()=>s.binding.capture()).toThrow();
  });
  it("project catalog is one bounded explicit page; errors retain existing choice candidates",async()=>{
    let afterSeen:string|null|undefined;const item={id:"project",workspaceId:"workspace",title:"A",revision:1,createdAt:at,updatedAt:at};
    const read=vi.fn(async(after:string|null)=>{afterSeen=after;return{projects:[item],nextCursor:"next"};});const projects=new ConversationProjects(read);cleanups.push(()=>projects.dispose());
    await projects.load();expect(read).not.toHaveBeenCalled();projects.setActive(true);await projects.load();expect(projects.getSnapshot().items).toHaveLength(1);expect(afterSeen).toBeNull();
    read.mockRejectedValueOnce(Error("page failed"));await projects.load(true);expect(read.mock.calls[1]?.[0]).toBe("next");expect(projects.getSnapshot().items[0]?.id).toBe("project");expect(projects.getSnapshot().error).toBe("page failed");
  });
  it("project deadline settles even an abort-ignoring port and permits explicit retry",async()=>{
    vi.useFakeTimers();const read=vi.fn(()=>new Promise<never>(()=>{}));const projects=new ConversationProjects(read);cleanups.push(()=>projects.dispose());projects.setActive(true);
    const pending=projects.load();await vi.advanceTimersByTimeAsync(15000);await pending;expect(projects.getSnapshot().loading).toBe(false);expect(projects.getSnapshot().error).toContain("timed out");const retry=projects.load();expect(read).toHaveBeenCalledTimes(2);projects.setActive(false);await retry;
  });
});
