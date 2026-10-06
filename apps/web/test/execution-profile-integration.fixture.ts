import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, preview as productionPreview } from "vite";
import type { DirectoryProfile } from "../src/execution-profiles/selection";
import { createConversationFixture } from "./conversation.fixture";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function profileFixture(n: number, label: string, access = "none"): DirectoryProfile {
  return {
    reference: { id: id(n), runnerId: id(n + 100), configDigest: String(n).repeat(64) },
    source: "runner-configured", availability: "not-probed", createdAt: "2026-10-06T00:00:00.000Z",
    configuration: { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2", model: `${label}-model`, thinking: "disabled", permissionMode: "dontAsk", access, requireReadApproval: false,
      materialScopeDigest: access === "goal-tools" ? "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" : "b".repeat(64),
      limits: { maxTurns: 4, maxBudgetUsd: 1, timeoutMs: 90000 } },
    model: { value: `${label}-model`, resolvedModel: null, displayName: `${label} profile ${n}`, description: "Public protocol fixture", providerCapabilities: "unknown" },
    controls: { model: "select-configured-profile", thinking: "fixed-disabled", effort: "unsupported", access: "configured-policy", queue: false, steer: false },
  };
}

/** Public HTTP fixture only. Receipt faults occur after durable simulated creation. */
function profileCenter(label: "A" | "B") {
  const fixture = createConversationFixture();
  const handler = fixture.server.listeners("request")[0] as (request: IncomingMessage, response: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const profiles = [profileFixture(1, label), profileFixture(2, label, "configured-readonly"), profileFixture(3, label, "goal-tools"), profileFixture(4, label, "future-access"), profileFixture(5, label)];
  const reads: string[] = [];
  let failure = 0, firstPageWithoutSelection = false;
  let creationFault: "lost" | "wrong-pin" | null = null;
  let creationDelay = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  fixture.server.on("request", (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/api/execution-profiles") {
      response.setHeader("access-control-allow-origin", "*"); response.setHeader("access-control-allow-headers", "authorization,content-type");
      if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
      reads.push(request.url!);
      const json = (value: unknown, status = 200) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };
      if (request.headers.authorization !== "Bearer flow-fixture-only") { json({ error: { code: "unauthorized", message: "Fixture token required" } }, 401); return; }
      if (failure) { json({ error: { code: "unavailable", message: "Simulated directory failure" } }, failure); return; }
      const after = url.searchParams.get("after");
      const page = after ? profiles.slice(4) : firstPageWithoutSelection ? profiles.slice(0, 1) : profiles.slice(0, 4);
      json({ profiles: page, nextCursor: after ? null : page.at(-1)!.reference.id }); return;
    }
    if (url.pathname === "/api/conversations" && request.method === "POST") {
      const fault = creationFault, delay = creationDelay; creationFault = null;
      if (fault || delay) {
        const end = response.end.bind(response);
        response.end = ((chunk: unknown) => {
          if (fault === "lost") { request.socket.destroy(); return response; }
          let body = String(chunk);
          if (fault === "wrong-pin") { const ack = JSON.parse(body); ack.conversation.executionProfile.runnerId = id(999); body = JSON.stringify(ack); }
          if (delay) { const timer = setTimeout(() => { timers.delete(timer); if (!response.destroyed) end(body); }, delay); timers.add(timer); }
          else end(body);
          return response;
        }) as typeof response.end;
      }
    }
    handler(request, response);
  });
  return { ...fixture, profiles, directoryReads: reads, failDirectory(status: number) { failure = status; },
    hideSelectionFromFirstPage(value: boolean) { firstPageWithoutSelection = value; },
    loseNextCreation() { creationFault = "lost"; }, wrongNextCreationPin() { creationFault = "wrong-pin"; },
    setCreationDelay(ms: number) { creationDelay = ms; }, close: async () => { timers.forEach(clearTimeout); await fixture.close(); } };
}

export async function startExecutionProfilePreview(production = false) {
  const first = profileCenter("A"), second = profileCenter("B"); const centers: string[] = [];
  for (const fixture of [first, second]) {
    await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
    const address = fixture.server.address(); if (!address || typeof address === "string") throw Error("Missing fixture address");
    centers.push(`http://127.0.0.1:${address.port}`);
  }
  const root = fileURLToPath(new URL("..", import.meta.url)); const proxy = { "/api": centers[0]! };
  const server = production ? await productionPreview({ root, preview: { host: "127.0.0.1", port: 0, proxy } })
    : await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy } });
  if ("listen" in server) await server.listen();
  const address = server.httpServer!.address(); if (!address || typeof address === "string") throw Error("Missing Web address");
  return { first, second, centers, url: `http://127.0.0.1:${address.port}`, close: async () => { await server.close(); await Promise.all([first.close(), second.close()]); } };
}
if (process.argv.includes("--profile-preview")) {
  const preview = await startExecutionProfilePreview();
  console.log(`Execution profiles · HTTP fixture only · no model: ${preview.url}`);
  console.log(`Public fixture centers: ${preview.centers.join(", ")} · token flow-fixture-only`);
  let closed = false; const close = async () => { if (closed) return; closed = true; await preview.close(); process.exit(); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}
