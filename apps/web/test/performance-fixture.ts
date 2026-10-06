import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import type { TaskSnapshot, TaskSummary, WorkspaceEntry, WorkspacePage, WorkspaceTask } from "@flow/contracts";
import { createFixture } from "./fixture-server";

export const FIXTURE_TOKEN = "flow-fixture-only";
export const TEXT_LENGTH = 256;
const timestamp = (cursor: number) => new Date(Date.UTC(2026, 9, 1) + cursor * 1000).toISOString();
const summary = (task: TaskSnapshot): TaskSummary => ({ id: task.id, title: task.title, harness: task.harness, status: task.status, verificationStatus: task.verificationStatus, createdAt: task.createdAt, updatedAt: task.updatedAt });
const taskView = (task: TaskSnapshot): WorkspaceTask => ({ ...summary(task), ownerVersion: 1, pendingDecision: task.pendingDecision });

/** Synthetic contract data only. Reuses the real HTTP fixture's task/SSE/detail semantics. */
export function createPerformanceFixture(taskCount: number, staticRoot?: string) {
  assert(Number.isInteger(taskCount) && taskCount > 0 && taskCount <= 128);
  const fixture = createFixture();
  const template = structuredClone(fixture.tasks.get("demo-completed")!);
  const artifact = structuredClone(fixture.details.get("demo-completed-artifact")!);
  fixture.tasks.clear(); fixture.details.clear();
  const ids = Array.from({ length: taskCount }, (_, index) => `perf-${String(index + 1).padStart(3, "0")}`);
  const entries: WorkspaceEntry[] = [];
  const workspaceResponses: { at: number; after: number | null; before: number | null; count: number; nextCursor: number; watermark: number }[] = [];
  let cursor = 0;
  let textCount = 0;
  for (const id of ids) {
    const content = `Synthetic artifact for ${id}.`;
    const detail = { ...artifact, artifactVersion: createHash("sha256").update(content).digest("hex"), id: `${id}-artifact`, title: `${id} report.txt`, content };
    fixture.details.set(detail.id, detail);
    const entry = { id: `${id}-reference`, cursor: 1, createdAt: timestamp(cursor), kind: "reference" as const, reference: { id: detail.id, title: detail.title } };
    const task: TaskSnapshot = { ...structuredClone(template), id, title: `Performance task ${id}`, status: "running", createdAt: timestamp(0), updatedAt: timestamp(cursor), pendingDecision: null, entries: [entry], watermark: 1, hasMore: false };
    fixture.tasks.set(id, task);
    entries.push({ id: `perf-record-${++cursor}`, cursor, task: { id, title: task.title }, entry });
  }
  const append = (count: number) => {
    assert(Number.isInteger(count) && count >= 0);
    for (let index = 0; index < count; index++) {
      const id = ids[textCount++ % ids.length]!;
      const task = fixture.tasks.get(id)!;
      const text = `Record ${textCount} for ${id}. `.padEnd(TEXT_LENGTH, "x");
      const entry = { id: `${id}-text-${textCount}`, cursor: ++task.watermark, createdAt: timestamp(cursor + 1), kind: "text" as const, text };
      task.entries.push(entry); task.updatedAt = entry.createdAt;
      entries.push({ id: `perf-record-${++cursor}`, cursor, task: { id, title: task.title }, entry });
    }
  };
  append(40);
  const initialWatermark = cursor;
  const original = fixture.server.listeners("request")[0] as (req: IncomingMessage, res: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const json = (res: ServerResponse, value: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(value)); };
  fixture.server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/")) {
      if (!staticRoot) { json(res, { error: "No static build configured" }, 404); return; }
      void serveStatic(staticRoot, url.pathname, res); return;
    }
    if (!["/api/workspace", "/api/task-index"].includes(url.pathname)) { original(req, res); return; }
    fixture.requests.push({ method: req.method ?? "GET", path: req.url! });
    if (req.headers.authorization !== `Bearer ${FIXTURE_TOKEN}`) { json(res, { error: { code: "unauthorized", message: "Fixture token required" } }, 401); return; }
    const tasks = [...fixture.tasks.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 40)));
    if (url.pathname === "/api/task-index") {
      const statuses = url.searchParams.get("statuses")?.split(",");
      const filtered = tasks.filter(task => !statuses || statuses.includes(task.status));
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      json(res, { tasks: filtered.slice(offset, offset + limit).map(summary), totalSize: filtered.length, nextCursor: offset + limit < filtered.length ? String(offset + limit) : null }); return;
    }
    const after = url.searchParams.has("after") ? Number(url.searchParams.get("after")) : null;
    const before = url.searchParams.has("before") ? Number(url.searchParams.get("before")) : null;
    const selected = after !== null ? entries.filter(entry => entry.cursor > after).slice(0, limit) : (before !== null ? entries.filter(entry => entry.cursor < before) : entries).slice(-limit);
    const attention = tasks.filter(task => task.status === "waiting" || task.status === "uncertain");
    const page: WorkspacePage = { workspaceId: "personal", entries: selected, nextCursor: selected.at(-1)?.cursor ?? after ?? cursor, previousCursor: selected[0]?.cursor ?? before ?? 0, watermark: cursor, hasMore: after !== null && entries.some(entry => entry.cursor > (selected.at(-1)?.cursor ?? after)), hasEarlier: entries.some(entry => entry.cursor < (selected[0]?.cursor ?? 0)), projectionPending: false, tasks: tasks.slice(0, 100).map(taskView), tasksTruncated: tasks.length > 100, attention: attention.slice(0, 100).map(taskView), attentionTruncated: attention.length > 100 };
    workspaceResponses.push({ at: performance.now(), after, before, count: selected.length, nextCursor: page.nextCursor, watermark: cursor });
    json(res, page);
  });
  return { ...fixture, ids, append, initialWatermark, workspaceResponses, watermark: () => cursor,
    waitForDecision(id = ids[0]!) { const task = fixture.tasks.get(id)!; task.status = "waiting"; task.pendingDecision = { id: `${id}-decision`, prompt: `Review synthetic change for ${id}.` }; task.updatedAt = new Date().toISOString(); },
    async listen() { await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve)); const address = fixture.server.address(); assert(address && typeof address !== "string"); return `http://127.0.0.1:${address.port}`; },
  };
}

async function serveStatic(root: string, pathname: string, res: ServerResponse) {
  try {
    const path = resolve(root, `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`);
    if (!path.startsWith(`${resolve(root)}${sep}`)) { res.writeHead(403); res.end(); return; }
    const contents = await readFile(path);
    const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" }); res.end(contents);
  } catch { res.writeHead(404); res.end(); }
}
