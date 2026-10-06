/** One fixed reviewed artifact transfer. No build, pointer change, report import, or service operation. */
import { constants } from 'node:fs';
import { open, lstat, realpath, readdir, mkdir, statfs } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const artifactId = 'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88';
const source = '/private/tmp/flow-release03-prepare-5069586-u1zh3mln/artifacts/web-artifacts/' + artifactId;
const installation = '/Users/citrine/.flow-personal';
const repository = '/Users/citrine/Projects/AgentHarness/Flow';
const expectedBackend = 'af51c621696230fbced12227670f014ca73bd8a1';
const sourceHead = '5069586a9f17332de526e101eca3a4250cbc8d91';
const totalBytes = 1_588_311;
const execute = promisify(execFile);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(code) { throw Object.assign(new Error(code), { code }); }
function errorCode(error) { return /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'TRANSFER_UNCONFIRMED'; }

async function directory(path) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || await realpath(path) !== path) fail('DIRECTORY_IDENTITY');
  return info;
}
async function absent(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  fail('DESTINATION_EXISTS');
}
async function boundedFile(path, expectedBytes, expectedHash) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.uid !== process.getuid() || info.size !== expectedBytes) fail('FILE_IDENTITY');
    const bytes = await file.readFile();
    if (bytes.length !== expectedBytes || sha(bytes) !== expectedHash) fail('FILE_INTEGRITY');
    return bytes;
  } finally { await file.close(); }
}
async function syncDirectory(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await file.sync(); } finally { await file.close(); }
}
async function writeExclusive(path, bytes) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}
async function record(path, value) {
  await writeExclusive(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
  await syncDirectory(dirname(path));
}
async function manifestAt(path) {
  await directory(path);
  const info = await lstat(join(path, 'manifest.json'));
  if (info.size > 16_384) fail('MANIFEST_BOUND');
  const bytes = await boundedFile(join(path, 'manifest.json'), info.size, artifactId);
  const manifest = JSON.parse(bytes);
  if (manifest.format !== 2 || manifest.policy !== 'flow-static-web-v2' || manifest.sourceHead !== sourceHead
    || manifest.releaseId !== '388371a4972c469b8ace623454594132'
    || manifest.files.length !== 10 || manifest.totalBytes !== totalBytes) fail('FIXED_ARTIFACT_REQUIRED');
  return { bytes, manifest };
}
async function verifyTree(path, manifest) {
  if (JSON.stringify((await readdir(path)).sort()) !== JSON.stringify(['dist', 'manifest.json'])) fail('ARTIFACT_ENTRIES');
  await directory(join(path, 'dist')); await directory(join(path, 'dist/assets'));
  const files = [];
  for (const name of (await readdir(join(path, 'dist'))).sort()) {
    if (name === 'assets') for (const child of (await readdir(join(path, 'dist/assets'))).sort()) files.push('assets/' + child);
    else files.push(name);
  }
  if (JSON.stringify(files.sort()) !== JSON.stringify(manifest.files.map(file => file.path).sort())) fail('ARTIFACT_ENTRIES');
  let count = 0;
  for (const file of manifest.files) {
    if (file.path !== 'index.html' && !/^assets\/[A-Za-z0-9_.-]+$/.test(file.path)) fail('ARTIFACT_PATH');
    count += (await boundedFile(join(path, 'dist', file.path), file.bytes, file.sha256)).length;
  }
  if (count !== manifest.totalBytes) fail('ARTIFACT_TOTAL');
}
async function renameExclusive(from, to) {
  // macOS SDK sys/stdio.h declares RENAME_EXCL=0x4; no ordinary rename fallback.
  if (process.platform !== 'darwin') fail('DARWIN_REQUIRED');
  const program = 'import ctypes,os,sys\nlib=ctypes.CDLL(None,use_errno=True)\nf=lib.renamex_np\nf.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_uint]\nf.restype=ctypes.c_int\nr=f(os.fsencode(sys.argv[1]),os.fsencode(sys.argv[2]),4)\nsys.exit(0 if r==0 else min(ctypes.get_errno(),125))\n';
  await execute('/usr/bin/python3', ['-c', program, from, to], { timeout: 2500, maxBuffer: 1024, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } });
}
async function fixedHostTools() {
  const head = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  const dirty = (await execute('git', ['-C', repository, 'status', '--porcelain'])).stdout;
  if (head !== expectedBackend || dirty) fail('FIXED_HOST_SOURCE_REQUIRED');
  return import(pathToFileURL(join(repository, 'tools/personal-preview/preview.mjs')).href);
}

export async function transferD629() {
  const tools = await fixedHostTools();
  const config = await tools.loadPreviewConfiguration(installation);
  const run = randomUUID(); const evidence = dirname(fileURLToPath(import.meta.url));
  return tools.withPreviewLock(config, async () => {
    await tools.assertPreviewMarker(config);
    const root = join(installation, 'web-artifacts'); await directory(root);
    const destination = join(root, artifactId); await absent(destination);
    const cached = (await readdir(root)).sort();
    const retained = ['461a97321e8c752352f45012373d1dac1d3e2bfc81d3799d1d156d301b3b6c90', 'caa1e938c90ff34ca377dca458f5b0cfa3d38b059972944b4e9f904ae9a4b9fe'];
    if (JSON.stringify(cached) !== JSON.stringify(retained)) fail('ARTIFACT_ROOT_CHANGED');
    const release = await tools.readPreviewJson(join(installation, 'web-release.json'));
    if (release.version !== 2 || release.current !== retained[1] || JSON.stringify(release.artifacts.map(a => a.artifactId).sort()) !== JSON.stringify(retained)) fail('WEB_RELEASE_CHANGED');
    const space = await statfs(root);
    if (Number(space.bavail) * Number(space.bsize) < 1_073_741_824 + 16_777_216) fail('SPACE_RESERVE_REQUIRED');
    const input = await manifestAt(source); await verifyTree(source, input.manifest);
    const stage = join(root, '.stage-d629-' + run);
    const facts = { run, artifactId, sourceHead, target: destination, stage, outcome: 'reserved', publication: 'not-attempted' };
    await record(join(evidence, run + '-reservation.json'), facts);
    try {
      await mkdir(stage, { mode: 0o700 }); const initial = await directory(stage); facts.stageIdentity = { dev: initial.dev, ino: initial.ino };
      await mkdir(join(stage, 'dist'), { mode: 0o700 }); await mkdir(join(stage, 'dist/assets'), { mode: 0o700 });
      for (const file of input.manifest.files) {
        const bytes = await boundedFile(join(source, 'dist', file.path), file.bytes, file.sha256);
        await writeExclusive(join(stage, 'dist', file.path), bytes);
      }
      await writeExclusive(join(stage, 'manifest.json'), input.bytes);
      await verifyTree(stage, input.manifest); await manifestAt(stage);
      await syncDirectory(join(stage, 'dist/assets')); await syncDirectory(join(stage, 'dist')); await syncDirectory(stage);
      await absent(destination); await directory(root);
      await record(join(evidence, run + '-prepared.json'), { ...facts, outcome: 'verified-stage', files: 10, bytes: totalBytes });
      facts.publication = 'unknown';
      await renameExclusive(stage, destination); facts.publication = 'rename-confirmed';
      await syncDirectory(root); await verifyTree(destination, input.manifest); await manifestAt(destination);
      await record(join(evidence, run + '-result.json'), { ...facts, outcome: 'artifact-present-verified', pointerChanged: false });
      return { artifactId, files: 10, bytes: totalBytes, published: true, pointerChanged: false };
    } catch (error) {
      // Keep stage or published artifact. An error cannot prove rename did not commit.
      await record(join(evidence, run + '-failure.json'), { ...facts, outcome: 'unknown-retained', errorCode: errorCode(error) }).catch(() => {});
      throw Object.assign(new Error('TRANSFER_UNCONFIRMED_KEEP_ARTIFACTS'), { code: 'TRANSFER_UNCONFIRMED_KEEP_ARTIFACTS' });
    }
  });
}

// Local tiny-file checks may use these file-only seams; they cannot load host credentials or run maintenance.
export { boundedFile, writeExclusive, verifyTree, renameExclusive };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute-reviewed-d629') {
    process.stderr.write('PREPARATION_ONLY: exact execution requires a separately approved operation window.\n'); process.exitCode = 1;
  } else {
    try { process.stdout.write(JSON.stringify(await transferD629()) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ code: errorCode(error), outcome: 'unconfirmed', retry: false }) + '\n'); process.exitCode = 1; }
  }
}
