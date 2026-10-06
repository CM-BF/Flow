import { idSchema, type ProjectList, type ProjectView } from "@flow/contracts";

/** One page (40 entries), explicit pagination, no implicit project selection. */
export class ConversationProjects {
  private state: { items: readonly ProjectView[]; nextCursor: string | null; after: string | null; loading: boolean; loaded: boolean; error: string | null } = { items: [], nextCursor: null, after: null, loading: false, loaded: false, error: null };
  private listeners = new Set<() => void>();
  private active = false;
  private closed = false;
  private flight: AbortController | null = null;
  constructor(private readonly read: (after: string | null, signal: AbortSignal) => Promise<ProjectList>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<typeof this.state>) { this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); }
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    if (!active) { this.flight?.abort(); this.flight = null; if (this.state.loading) this.update({ loading: false }); }
  }
  async load(more = false) {
    if (!this.active || this.closed || this.state.loading || (more && !this.state.nextCursor)) return;
    const after = more ? this.state.nextCursor : null, controller = new AbortController(); this.flight = controller;
    this.update({ loading: true, error: null });
    const timer = setTimeout(() => controller.abort(Error("Project request timed out. Retry this page.")), 15_000);
    let onAbort: () => void = () => {};
    try {
      const stopped = new Promise<never>((_, reject) => { onAbort = () => reject(controller.signal.reason); controller.signal.addEventListener("abort", onAbort, { once: true }); });
      const page = await Promise.race([this.read(after, controller.signal), stopped]);
      if (controller.signal.aborted || this.flight !== controller) return;
      if (!Array.isArray(page.projects) || page.projects.length > 40 || (page.nextCursor !== null && (!idSchema.safeParse(page.nextCursor).success || page.nextCursor === after))) throw Error("Invalid project page.");
      const seen = new Set<string>();
      const items = page.projects.map(item => {
        if (!idSchema.safeParse(item.id).success || !idSchema.safeParse(item.workspaceId).success || typeof item.title !== "string" || !item.title.trim() || item.title.length > 180 || !Number.isInteger(item.revision) || item.revision < 1 || !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.updatedAt)) || seen.has(item.id)) throw Error("Invalid project identity.");
        seen.add(item.id); return Object.freeze({ ...item });
      });
      this.update({ items: Object.freeze(items), nextCursor: page.nextCursor, after, loaded: true });
    } catch (error) { if (this.flight === controller && this.active && !this.closed) this.update({ error: error instanceof Error ? error.message : "Project page could not load." }); }
    finally { clearTimeout(timer); controller.signal.removeEventListener("abort", onAbort); if (this.flight === controller) { this.flight = null; this.update({ loading: false }); } }
  }
  dispose() { this.setActive(false); this.closed = true; this.listeners.clear(); }
}
