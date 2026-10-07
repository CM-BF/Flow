// Reuses the reviewed sequential noEmit/direct runner; all children inherit its owned process group.
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const base = fileURLToPath(new URL(".", import.meta.url));
const binding = JSON.parse(await readFile(join(base, "binding.json"), "utf8"));
const deadline = Number(process.env.MSGQUICK_WORK_DEADLINE_MS);
const results = [];
for (const step of binding.steps) {
  if (!Number.isFinite(deadline) || Date.now() >= deadline) {
    results.push({ name: step.name, error: "WORK_DEADLINE", exitCode: null, signal: null, elapsedMs: 0 });
    await writeFile(join(base, "scratch", "step-results.json"), JSON.stringify(results, null, 2) + "\n");
    process.exitCode = 1; break;
  }
  const start = performance.now();
  const result = await new Promise(resolve => {
    const child = spawn(binding.node.path, step.args, { cwd: binding.worktree, env: process.env, stdio: "inherit", detached: false });
    let settled = false;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    child.once("error", error => finish({ error: error.code ?? "SPAWN_ERROR", exitCode: null, signal: null }));
    child.once("close", (exitCode, signal) => finish({ exitCode, signal }));
  });
  results.push({ name: step.name, ...result, elapsedMs: Math.round(performance.now() - start) });
  await writeFile(join(base, "scratch", "step-results.json"), JSON.stringify(results, null, 2) + "\n");
  if (result.exitCode !== 0 || result.signal || result.error) { process.exitCode = 1; break; }
}
