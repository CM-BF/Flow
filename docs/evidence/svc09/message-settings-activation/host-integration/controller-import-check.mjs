import assert from 'node:assert/strict';
import { readFile, lstat, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareControllerDriver } from './controller-loader.mjs';
assert.deepEqual(process.argv.slice(2), ['--load-controller-only']);
const input = JSON.parse(await readFile(new URL('./controller-driver-inputs.json', import.meta.url), 'utf8'));
const scratch = process.env.FLOW_SVC09A_CONTROLLER_SCRATCH;
assert.match(scratch, /^\/private\/tmp\/flow-svc09a-controller-[A-Za-z0-9_-]+$/);
let prepared, primary = null; const cleanup = [];
try {
  prepared = await prepareControllerDriver(input, join(scratch, 'driver'));
  const controller = await import(pathToFileURL(prepared.entry));
  const artifact = await import(pathToFileURL(join(input.artifactRoot, 'tools/personal-preview/preview.mjs')));
  for (const name of ['loadPreviewConfiguration', 'withPreviewLock', 'statusPreview', 'stopPreview']) assert.equal(typeof artifact[name], 'function');
  assert.notEqual(controller.startPreviewServices, artifact.startPreviewServices);
  await assert.rejects(controller.startPreviewServices(null, null, null, null, {}), { code: 'START_STATUS_PORT_INVALID' });
  await assert.rejects(prepareControllerDriver(input, join(scratch, 'driver')), { code: 'EEXIST' });
} catch (error) { primary = { name: error.name, code: typeof error.code === 'string' ? error.code : null }; }
finally {
  if (prepared) for (const pin of [...prepared.identities].reverse()) {
    try {
      const info = await lstat(pin.path, { bigint: true });
      assert.equal(String(info.dev), pin.dev); assert.equal(String(info.ino), pin.ino);
      assert.equal(info.isSymbolicLink() ? 'symlink' : info.isDirectory() ? 'directory' : 'file', pin.kind);
      if (pin.kind === 'directory') await rmdir(pin.path); else await unlink(pin.path);
      cleanup.push({ path: pin.path, state: 'removed' });
    } catch (error) { cleanup.push({ path: pin.path, state: 'KEEP', code: typeof error.code === 'string' ? error.code : null }); break; }
  }
}
const result = { primary, assertionScope: ['actual fixed controller and artifact imports', 'distinct controller start and original artifact public ports', 'invalid status port before private I/O', 'existing shadow namespace refused'], created: prepared?.identities ?? null, cleanup, artifactMutations: 0, services: 0, pg: 0, provider: 0 };
process.stdout.write(JSON.stringify(result) + '\n');
process.exitCode = primary || !prepared || cleanup.some(value => value.state !== 'removed') ? 1 : 0;
