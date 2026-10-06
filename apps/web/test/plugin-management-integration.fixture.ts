import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer, preview as productionPreview } from "vite";
import type { PluginInstallation, PluginOperation, PluginSnapshot, PluginVersion } from "@flow/contracts";
import { createConversationFixture } from "./conversation.fixture";

/** Public HTTP protocol fixture only: no database, SDK, package load, or model. */
function registryCenter(label: "A" | "B") {
  const fixture = createConversationFixture();
  const handler = fixture.server.listeners("request")[0] as (request: IncomingMessage, response: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const at = "2026-10-06T00:00:00.000Z";
  const installations: PluginInstallation[] = Array.from({ length: 11 }, (_, index) => ({
    id: `registration-${index}`, scope: { workspaceId: "personal", projectId: null },
    packageName: index ? `@fixture/plugin-${index}` : "sample.notes", revision: 3,
    registrationStatus: "registered", runtimeStatus: "unavailable", runtimeReason: "package_not_verified_or_loaded", createdAt: at, updatedAt: at,
  }));
  const versions: PluginVersion[] = Array.from({ length: 12 }, (_, index) => ({
    id: `version-${index}`, createdAt: at, packageName: "sample.notes", packageVersion: `1.${index}.0`,
    source: "npm", declaredSha256: "a".repeat(64), license: "MIT", hostApiMajor: 1,
    capabilities: ["renderer"], publicConfiguration: [{ key: "center", kind: "enum", required: true, values: ["A", "B"] }],
  }));
  const operations: PluginOperation[] = Array.from({ length: 12 }, (_, index) => ({
    id: `operation-${index}`, installationId: "registration-0", kind: index ? "configure" : "register", status: "succeeded",
    actor: "owner", inputDigest: "b".repeat(64), beforeRevision: index || null, afterRevision: index + 1, createdAt: at,
  }));
  const reads: { method: string; path: string }[] = [];
  let holdDetail = false;
  let abortedReads = 0;
  let release: (() => void) | undefined;
  fixture.server.on("request", (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/api/plugins")) { handler(request, response); return; }
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "authorization,content-type");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    reads.push({ method: request.method ?? "GET", path: request.url! });
    const json = (value: unknown, status = 200) => { if (!response.destroyed) { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); } };
    if (request.headers.authorization !== "Bearer flow-fixture-only") { json({ error: { code: "unauthorized", message: "Fixture token required" } }, 401); return; }
    if (request.method !== "GET") { json({ error: { code: "read_only", message: "Registry fixture is read-only" } }, 405); return; }
    const parts = url.pathname.split("/").filter(Boolean);
    const offset = Number(url.searchParams.get("after") ?? 0), limit = Number(url.searchParams.get("limit") ?? 10);
    const page = <T,>(items: T[], key: string) => ({ [key]: items.slice(offset, offset + limit), nextCursor: items.length > offset + limit ? String(offset + limit) : null });
    if (parts.length === 2) { json(page(installations, "installations")); return; }
    if (parts[3] === "versions") { json(page(versions, "versions")); return; }
    if (parts[3] === "operations") { json(page(operations, "operations")); return; }
    const installation = installations.find(item => item.id === parts[2]);
    if (!installation) { json({ error: { code: "not_found", message: "Unknown registration" } }, 404); return; }
    const snapshot: PluginSnapshot = { installation, revision: installation.revision, version: versions[0]!, configuration: { center: label }, configurationStatus: "ready", grants: ["renderer"] };
    if (holdDetail) {
      holdDetail = false;
      response.on("close", () => { if (!response.writableEnded) abortedReads++; });
      release = () => { json(snapshot); release = undefined; };
    } else json(snapshot);
  });
  return { ...fixture, registryReads: reads, holdNextDetail: () => { holdDetail = true; }, abortedReads: () => abortedReads,
    releaseDetail: () => release?.(), label };
}

export async function startPluginManagementPreview(production = false) {
  const first = registryCenter("A"), second = registryCenter("B");
  const centers: string[] = [];
  for (const fixture of [first, second]) {
    await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
    const address = fixture.server.address();
    if (!address || typeof address === "string") throw Error("Missing fixture address");
    centers.push(`http://127.0.0.1:${address.port}`);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  const proxy = { "/api": centers[0]! };
  const server = production
    ? await productionPreview({ root, preview: { host: "127.0.0.1", port: 0, proxy } })
    : await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy } });
  if ("listen" in server) await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw Error("Missing Web address");
  return { first, second, centers, url: `http://127.0.0.1:${address.port}`, close: async () => {
    first.releaseDetail(); second.releaseDetail();
    await server.close();
    await Promise.all([first.close(), second.close()]);
  } };
}
if (process.argv.includes("--app-preview")) {
  const preview = await startPluginManagementPreview();
  console.log(`HTTP fixture only: ${preview.url}`);
  console.log(`Fixture centers: ${preview.centers.join(", ")} · token flow-fixture-only`);
  let closed = false;
  const close = async () => { if (closed) return; closed = true; await preview.close(); process.exit(); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}
