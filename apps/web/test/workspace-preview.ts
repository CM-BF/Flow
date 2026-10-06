import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { createWorkspaceFixture } from "./workspace-fixture";
export async function startWorkspacePreview() {
  const fixture = createWorkspaceFixture();
  await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
  const address = fixture.server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture address.");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const vite = await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, strictPort: false, proxy: { "/api": `http://127.0.0.1:${address.port}` } } });
  await vite.listen();
  const viteAddress = vite.httpServer!.address();
  if (!viteAddress || typeof viteAddress === "string") throw new Error("Missing Web address.");
  return { fixture, url: `http://127.0.0.1:${viteAddress.port}`, close: async () => { await vite.close(); await fixture.close(); } };
}
if (process.argv.includes("--preview")) {
  const preview = await startWorkspacePreview();
  process.stdout.write(`WPF-M02 HTTP fixture preview (simulated): ${preview.url}\n`);
  const close = async () => { await preview.close(); process.exit(0); };
  process.on("SIGINT", close); process.on("SIGTERM", close);
}
