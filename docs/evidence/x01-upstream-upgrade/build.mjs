import { build, version } from 'esbuild';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const base = 'experiments/plugins/semver-range-upgrade';
if (version !== '0.28.2') throw new Error('Wrong esbuild version');
const hash = b => createHash('sha256').update(b).digest('hex');
for (const release of ['7.8.4', '7.8.5']) {
  const packageDir = path.join(root, base, 'releases', release, 'package');
  await fs.mkdir(packageDir, { recursive: true });
  const entry = `${base}/adapter.mjs`;
  const result = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'node24',
    outfile: path.join(packageDir, 'index.mjs'), metafile: true, write: false, legalComments: 'inline',
    alias: { 'semver/functions/satisfies.js': path.join(root, base, 'upstream', release, 'package/functions/satisfies.js') } });
  if (result.outputFiles.length !== 1 || Object.values(result.metafile.outputs).some(v => v.imports.some(i => i.external))) throw new Error('Incomplete static bundle');
  const closure = [];
  for (const name of Object.keys(result.metafile.inputs)) {
    if (name !== entry && !name.startsWith(`${base}/upstream/${release}/package/`)) throw new Error('Unexpected build input');
    const bytes = await fs.readFile(path.join(root, name)); closure.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const source = JSON.parse(await fs.readFile(path.join(root, base, 'upstream', release, 'source-receipt.json'), 'utf8'));
  const bundle = result.outputFiles[0].contents;
  await fs.writeFile(path.join(packageDir, 'index.mjs'), bundle, { flag: 'wx' });
  const files = { 'package.json': { name: 'flow-semver-range', version: release, type: 'module', license: 'ISC' },
    'flow-plugin.json': { schemaVersion: 1, hostApiMajor: 1, kind: 'tool', entrypoint: 'index.mjs' },
    'upstream.json': { name: 'semver', version: release, gitHead: source.gitHead, integrity: source.integrity, license: source.license } };
  for (const [name, value] of Object.entries(files)) await fs.writeFile(path.join(packageDir, name), JSON.stringify(value) + '\n', { flag: 'wx' });
  await fs.writeFile(path.join(packageDir, 'license.txt'), await fs.readFile(path.join(root, base, 'upstream', release, 'package/LICENSE')), { flag: 'wx' });
  const record = { esbuild: version, release, closure, externalRuntimeImports: [], bundle: { bytes: bundle.length, sha256: hash(bundle) }, metafile: result.metafile };
  await fs.writeFile(path.join(root, base, 'releases', release, 'build-receipt.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ release, inputCount: closure.length, bundle: record.bundle }));
}
