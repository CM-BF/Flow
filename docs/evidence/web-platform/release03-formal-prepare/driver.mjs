import { readFile, writeFile, stat } from 'node:fs/promises';
import { prepareWebArtifact, verifyWebArtifact } from './tools/web-artifact.mjs';
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
const diagnosticNames = ['artifact-result.json', 'driver-failure.json'];
const driverJsonBytes = 65_536; // Reserved in full by the parent supervisor.
async function writeDiagnostic(name, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  let used = 0;
  for (const item of diagnosticNames) {
    try { used += (await stat(`${config.run}/${item}`)).size; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (used + bytes.length > driverJsonBytes) throw Error('DRIVER_JSON_BUDGET');
  await writeFile(`${config.run}/${name}`, bytes, { flag: 'wx', mode: 0o600 });
}
try {
  const artifact = await prepareWebArtifact({ repository: config.sourceRepository, target: config.target, directory: `${config.run}/artifacts`, releaseId: config.releaseId });
  const verified = await verifyWebArtifact({ directory: `${config.run}/artifacts`, artifact });
  await writeDiagnostic('artifact-result.json', { artifact, ...verified, approvedProvenance: config.approvedProvenance });
  process.stdout.write(`${JSON.stringify({ ok: true, artifact })}\n`);
} catch (error) {
  try { await writeDiagnostic('driver-failure.json', { code: error?.code ?? null, message: String(error?.message ?? error).slice(0, 512) }); }
  catch { process.stderr.write('DRIVER_DIAGNOSTIC_FAILED\n'); }
  process.stderr.write(`${error?.code ?? 'PREPARE_FAILED'}\n`); process.exitCode = 1;
}
