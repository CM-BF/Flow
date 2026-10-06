import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { TaskSnapshot, TaskSummary, WorkspaceEntry, WorkspacePage, WorkspaceTask } from "@flow/contracts";
import { createFixture } from "./fixture-server";

/** Deterministic HTTP contract fixture. This is not a real center or runner. */
export function createWorkspaceFixture() {
  const fixture = createFixture();
  const original = fixture.server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  let entries: WorkspaceEntry[] = [];
  let cursor = 0;
  const projected = new Set<string>();
  let failReads = false;
  let pending = false;
  let rotateDecision = false;
  const summary = (task: TaskSnapshot): TaskSummary => ({ id: task.id, title: task.title, harness: task.harness, status: task.status, verificationStatus: task.verificationStatus, createdAt: task.createdAt, updatedAt: task.updatedAt });
  const taskView = (task: TaskSnapshot): WorkspaceTask => ({ ...summary(task), ownerVersion: 1, pendingDecision: task.pendingDecision });
  const project = () => {
    for (const task of fixture.tasks.values()) for (const entry of task.entries) {
      const key = `${task.id}:${entry.id}`;
      if (projected.has(key)) continue;
      projected.add(key);
      entries.push({ id: `workspace-${++cursor}`, cursor, task: { id: task.id, title: task.title }, entry });
    }
  };
  const append = (id: string, text: string) => {
    const task = fixture.tasks.get(id)!;
    task.entries.push({ id: randomUUID(), cursor: ++task.watermark, createdAt: new Date().toISOString(), kind: "text", text });
    project();
  };
  const seed = (count: number, waiting = false) => {
    const template = fixture.tasks.get("demo-completed")!;
    for (let i = 0; i < count; i++) {
      const id = `workspace-extra-${fixture.tasks.size}`;
      const task: TaskSnapshot = structuredClone(template);
      Object.assign(task, { id, title: `Independent task ${id.split("-").at(-1)}`, status: waiting ? "waiting" : "succeeded", entries: [], watermark: 0, pendingDecision: waiting ? { id: `decision-${id}`, prompt: `Approve the next step for ${id}?` } : null });
      fixture.tasks.set(id, task);
      append(id, `Progress for ${task.title}. This HTTP fixture does not execute a model.`);
    }
  };
  seed(6, true);
  project();
  fixture.server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization,content-type,idempotency-key");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const json = (value: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
    if (rotateDecision && url.pathname.endsWith("/decision")) {
      rotateDecision = false;
      const id = decodeURIComponent(url.pathname.split("/")[3]!);
      const task = fixture.tasks.get(id)!;
      task.pendingDecision = { id: `replacement-${randomUUID()}`, prompt: "The previous request expired. Review this new decision separately." };
      task.updatedAt = new Date().toISOString();
    }
    if (!["/api/workspace", "/api/task-index"].includes(url.pathname)) { original(req, res); return; }
    fixture.requests.push({ method: req.method ?? "GET", path: req.url! });
    if (req.headers.authorization !== "Bearer flow-fixture-only") return json({ error: { code: "unauthorized", message: "Fixture token required." } }, 401);
    if (failReads) return json({ error: { code: "unavailable", message: "The simulated center is unavailable." } }, 503);
    const tasks = [...fixture.tasks.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    if (url.pathname === "/api/task-index") {
      const statuses = url.searchParams.get("statuses")?.split(",");
      const filtered = tasks.filter(task => !statuses || statuses.includes(task.status));
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 40);
      const page = filtered.slice(offset, offset + limit);
      return json({ tasks: page.map(summary), totalSize: filtered.length, nextCursor: offset + limit < filtered.length ? String(offset + limit) : null });
    }
    project();
    const after = url.searchParams.has("after") ? Number(url.searchParams.get("after")) : null;
    const before = url.searchParams.has("before") ? Number(url.searchParams.get("before")) : null;
    const limit = Number(url.searchParams.get("limit") ?? 40);
    if (after !== null && after > cursor) return json({ error: { code: "workspace_cursor_reset", message: "Workspace projection reset." } }, 409);
    const selected = after !== null ? entries.filter(entry => entry.cursor > after).slice(0, limit) : (before !== null ? entries.filter(entry => entry.cursor < before) : entries).slice(-limit);
    const attention = tasks.filter(task => task.status === "waiting" || task.status === "uncertain");
    const page: WorkspacePage = { workspaceId: "personal", entries: selected, nextCursor: selected.at(-1)?.cursor ?? after ?? cursor, previousCursor: selected[0]?.cursor ?? before ?? 0, watermark: cursor, hasMore: after !== null && entries.some(entry => entry.cursor > (selected.at(-1)?.cursor ?? after)), hasEarlier: entries.some(entry => entry.cursor < (selected[0]?.cursor ?? 0)), projectionPending: pending, tasks: tasks.slice(0, 100).map(taskView), tasksTruncated: tasks.length > 100, attention: attention.slice(0, 100).map(taskView), attentionTruncated: attention.length > 100 };
    return json(page);
  });
  return { ...fixture, append, seed, failReads(value: boolean) { failReads = value; }, setProjectionPending(value: boolean) { pending = value; }, conflictNextDecision() { rotateDecision = true; }, resetProjection() { entries = []; cursor = 0; projected.clear(); for (const task of fixture.tasks.values()) task.entries = []; append("demo-running", "Fresh workspace after projection reset."); } };
}
