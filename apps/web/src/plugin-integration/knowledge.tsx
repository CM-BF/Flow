import { createContext, useContext, useSyncExternalStore } from "react";
import type { ConversationCreation, KnowledgeSearchResult, KnowledgeResolved, ProjectList } from "@flow/contracts";
import { createContextSelection, type ContextSelection } from "../conversation-context/controller";
import { ContextPicker } from "../conversation-context/ContextPicker";
import { ConversationProjects } from "../conversation-context/projects";
import type { FrozenCitation } from "../conversation-context/selection";
import type { ConversationProjection } from "../conversations/projection";
import type { AppPluginSession } from "./session";
import type { PluginDefinition, ResourceContext } from "../plugins/types";
import { PluginView } from "../plugins/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";

export const KNOWLEDGE_OWNER = "flow.conversation-knowledge";
export const KNOWLEDGE_PANEL = "flow.conversation-knowledge.panel";
export interface KnowledgeIdentity { connectionId: string; viewKey: string; conversationId: string | null; projectId: string | null }
export interface KnowledgeReaders {
  current(identity: KnowledgeIdentity): boolean;
  projects(identity: KnowledgeIdentity, after: string | null, signal: AbortSignal): Promise<ProjectList>;
  search(identity: KnowledgeIdentity, query: { q: string; limit: number }, signal: AbortSignal): Promise<KnowledgeSearchResult>;
  resolve(identity: KnowledgeIdentity, citation: FrozenCitation, signal: AbortSignal): Promise<KnowledgeResolved>;
}
interface KnowledgeState { open: boolean; visible: boolean; projectId: string | null; projectTitle: string | null; controller: ContextSelection | null; error: string | null }
export interface SelectionCapture { controller: ContextSelection | null; token: unknown; knowledge?: readonly FrozenCitation[] }

/** Local draft selection survives route renaming; center identity and P01 still own authorization. */
export class ConversationKnowledge {
  readonly projects: ConversationProjects;
  private state: KnowledgeState = { open: false, visible: false, projectId: null, projectTitle: null, controller: null, error: null };
  private listeners = new Set<() => void>();
  private closed = false;
  private viewId = "";
  private unsubscribers: (() => void)[];
  constructor(readonly viewKey: string, readonly projection: ConversationProjection, private readonly session: AppPluginSession) {
    this.projects = new ConversationProjects((after, signal) => this.session.readKnowledgeProjects(this.identity(), this.context(), after, signal));
    this.unsubscribers = [projection.subscribe(() => this.sync()), session.host.subscribe(() => this.sync())];
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<KnowledgeState>) { if (!this.closed) { this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); } }
  context(): ResourceContext { return { kind: "composer", viewId: this.viewId, isDraft: true }; }
  identity(): KnowledgeIdentity { const conversation = this.projection.getSnapshot().snapshot?.conversation; return { connectionId: this.session.id, viewKey: this.viewKey, conversationId: conversation?.id ?? null, projectId: conversation?.projectId ?? null }; }
  configure(viewId: string, visible: boolean) { this.viewId = viewId; if (visible !== this.state.visible) this.update({ visible }); this.sync(); }
  locked() { const source = this.projection.getSnapshot(); return source.snapshot?.conversation ?? (source.outbox?.state !== "rejected" ? source.outbox?.creation : null); }
  private allowed() { return this.state.visible && this.projection.getSnapshot().connection === "live" && this.session.canReadKnowledge(this.identity(), this.context(), false); }
  sync() {
    if (this.closed) return;
    const source = this.projection.getSnapshot(), conversation = source.snapshot?.conversation;
    const projectId = conversation?.projectId;
    if (projectId && !this.state.controller) {
      const identity = Object.freeze(this.identity());
      const controller = createContextSelection({ binding: { connectionKey: this.session.id, viewId: this.viewKey, projectId },
        readiness: { visible: false, online: false, authorized: false, knowledgeContext: false },
        port: { search: (query, signal) => this.session.readKnowledgeSearch(identity, this.context(), query, signal), resolve: (citation, signal) => this.session.readKnowledgeBody(identity, this.context(), citation, signal) } });
      this.update({ controller, projectId, projectTitle: this.state.projectId === projectId ? this.state.projectTitle : projectId });
    }
    const active = this.allowed();
    this.projects.setActive(active && this.state.open && !this.locked());
    this.state.controller?.setReadiness({ visible: active && this.state.open, online: source.connection === "live", authorized: this.session.canReadKnowledge(this.identity(), this.context(), true), knowledgeContext: source.snapshot?.capabilities.knowledgeContext === true });
  }
  open() { if (!this.allowed()) throw Error("Show this online conversation before choosing knowledge."); this.update({ open: true, error: null }); this.sync(); if (!this.locked() && !this.projects.getSnapshot().loaded) void this.projects.load(); }
  close() { this.update({ open: false }); this.sync(); }
  choose(projectId: string | null) {
    if (this.locked()) throw Error("The conversation project is locked by its creation receipt.");
    const project = this.projects.getSnapshot().items.find(item => item.id === projectId);
    if (projectId && !project) throw Error("Choose a project from the loaded page.");
    this.update({ projectId, projectTitle: project?.title ?? null, error: null });
  }
  creation(input: ConversationCreation): ConversationCreation { return { ...input, ...(this.state.projectId ? { projectId: this.state.projectId } : {}) }; }
  capture(): SelectionCapture {
    if (this.closed) throw Error("This knowledge connection is closed.");
    this.sync();
    const controller = this.state.controller;
    const token = controller?.getSnapshot().selected;
    const knowledge = controller?.freeze();
    this.projection.validateKnowledge(knowledge);
    return { controller, token, ...(knowledge === undefined ? {} : { knowledge }) };
  }
  consume(capture: SelectionCapture) {
    const controller = this.state.controller;
    if (this.closed || !controller || controller !== capture.controller || controller.getSnapshot().selected !== capture.token) return;
    // Check the draft generation once; each removal intentionally changes it.
    for (const item of controller.getSnapshot().selected) controller.remove(item.citation);
  }
  dispose() { if (this.closed) return; this.closed = true; this.unsubscribers.forEach(stop => stop()); this.projects.dispose(); this.state.controller?.dispose(); this.listeners.clear(); }
}
const BoundKnowledge = createContext<ConversationKnowledge | null>(null);
function KnowledgePanel() {
  const binding = useContext(BoundKnowledge)!;
  const state = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const projects = useSyncExternalStore(binding.projects.subscribe, binding.projects.getSnapshot);
  const source = useSyncExternalStore(binding.projection.subscribe, binding.projection.getSnapshot);
  const setup = useContext(KnowledgeSetup)!;
  const locked = binding.locked();
  return <div className="space-y-3 text-sm">
    {locked ? <p>{source.snapshot ? "Conversation project locked" : "Creation receipt pending"}: {locked.projectId ?? "No project · plain text only"}</p> : <>
      <label className="block">Project<select aria-label="Conversation project" className="mt-1 block w-full rounded border border-input bg-background p-2 text-foreground" value={state.projectId ?? ""} onChange={event => binding.choose(event.target.value || null)}>
        <option value="">No project</option>{state.projectId && !projects.items.some(item => item.id === state.projectId) && <option value={state.projectId}>{state.projectTitle} · selected on another page</option>}
        {projects.items.map(project => <option key={project.id} value={project.id}>{project.title} · {project.id}</option>)}
      </select></label>
      <div className="flex flex-wrap gap-3"><button className="flow-link" type="button" disabled={projects.loading} onClick={() => void binding.projects.load()}>Refresh projects</button>{projects.nextCursor && <button className="flow-link" type="button" disabled={projects.loading} onClick={() => void binding.projects.load(true)}>Next projects</button>}</div>
      {projects.loading && <p role="status">Loading projects…</p>}{projects.error && <p role="alert">{projects.error}</p>}{projects.loaded && !projects.items.length && <p>No projects on this page. Plain text chat is available.</p>}
      <p className="text-muted-foreground">Preparing locks the project and execution settings, without sending a message or starting a model.</p>
      <button type="button" className="rounded border px-3 py-2" disabled={!state.projectId || !!setup.reason} onClick={() => void setup.prepare()}>Prepare conversation in project</button>{setup.reason && <p role="status">{setup.reason}</p>}
    </>}
    {source.snapshot?.capabilities.knowledgeContext === true && state.controller ? <ContextPicker controller={state.controller} /> : <p className="text-muted-foreground">{source.snapshot ? "Knowledge context is unavailable for this conversation. Plain text remains available." : "Prepare a project conversation to check this center’s knowledge capability."}</p>}
    {setup.error && <p role="alert">{setup.error}</p>}
  </div>;
}
const KnowledgeSetup = createContext<{ prepare(): Promise<void>; reason: string | null; error: string | null } | null>(null);
export function KnowledgeComposer({ binding, session, prepare, reason, error, children }: { binding: ConversationKnowledge; session: AppPluginSession; prepare(): Promise<void>; reason: string | null; error: string | null; children: React.ReactNode }) {
  const state = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const active = useSyncExternalStore(session.host.subscribe, () => session.host.list().find(plugin => plugin.id === KNOWLEDGE_OWNER)?.state === "active");
  return <BoundKnowledge.Provider value={binding}><KnowledgeSetup.Provider value={{ prepare, reason, error }}>
    {children}
    <Dialog open={state.open && state.visible && active} onOpenChange={open => { if (!open) binding.close(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" onCloseAutoFocus={event => { event.preventDefault(); [...document.querySelectorAll<HTMLButtonElement>(`[data-composer-view="${CSS.escape((binding.context() as { viewId: string }).viewId)}"] button`)].find(button => button.textContent === "Knowledge")?.focus(); }}><DialogHeader><DialogTitle>Conversation knowledge</DialogTitle><DialogDescription>Choose a project and fixed knowledge references. Your message draft stays separate.</DialogDescription></DialogHeader>
      <PluginView host={session.host} contributionId={KNOWLEDGE_PANEL} context={binding.context()} />
    </DialogContent></Dialog>
  </KnowledgeSetup.Provider></BoundKnowledge.Provider>;
}
export function KnowledgeSelectionSummary({ binding }: { binding: ConversationKnowledge }) {
  const state = useSyncExternalStore(binding.subscribe, binding.getSnapshot);
  const selected = useSyncExternalStore(state.controller?.subscribe ?? (() => () => {}), () => state.controller?.getSnapshot().selected);
  return selected?.length ? <p role="status">{selected.length} knowledge references selected for your next message.</p> : null;
}
export function createKnowledgePlugin(open: (viewId: string) => void): PluginDefinition {
  return { manifest: { id: KNOWLEDGE_OWNER, version: "1.0.0", hostApi: 1, capabilities: ["ui.layout", "workspace.read", "knowledge.read"], activationEvents: ["command:flow.conversation-knowledge.open", "view:chat.composer.context"],
    commands: [{ id: "flow.conversation-knowledge.open", title: "Knowledge", capability: "ui.layout", contexts: ["composer"] }],
    contributions: [{ kind: "button", id: "flow.conversation-knowledge.button", slot: "chat.composer.actions", title: "Knowledge", commandId: "flow.conversation-knowledge.open" }, { kind: "panel", id: KNOWLEDGE_PANEL, slot: "chat.composer.context", title: "Conversation knowledge", capability: "ui.layout" }] },
    load: async () => ({ activate(context) { context.command("flow.conversation-knowledge.open", { parse: () => null, run: (_, command) => { if (command.resource.kind !== "composer") throw Error("A conversation composer is required."); open(command.resource.viewId); } }); context.contribute(KNOWLEDGE_PANEL, KnowledgePanel); } }) };
}
