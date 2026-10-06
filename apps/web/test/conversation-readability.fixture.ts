import { startStreamPreview } from "./conversation-stream-integration.fixture";

/** Existing public HTTP fixtures, isolated ports; no model, DB or service mutation. */
export const startReadabilityPreview = (production = false) => startStreamPreview(production);

if (process.argv.includes("--readability-preview")) {
  const preview = await startReadabilityPreview();
  console.log(`Chat readability HTTP fixture (simulated, no model/DB): ${preview.url}`);
  console.log(`Centers ${preview.centers.join(", ")}; public token flow-fixture-only`);
  const stop = async () => { await preview.close(); process.exit(); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
}
