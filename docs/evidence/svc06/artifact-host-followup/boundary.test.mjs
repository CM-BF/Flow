import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, lstat, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const artifact = '/private/tmp/flow-svc06-fixed-artifact-c52Zw6/backend-artifacts/e5fed419b73beb733ff78d958192813c6ac6ecc7887c1c408d9e5f7b31a552b2/root';
const processes = await import(pathToFileURL(join(artifact, 'tools/personal-preview/process.mjs')).href);
const roots = ['/Users/citrine/Projects/AgentHarness/Flow', '/Users/citrine/Projects/AgentHarness/Flow-worktrees', '/System/Volumes/Data/Users/citrine/Projects/AgentHarness/Flow', '/System/Volumes/Data/Users/citrine/Projects/AgentHarness/Flow-worktrees'];
const paths = roots.map((root, i) => join(root, i % 2 ? 'backend-release/package.json' : 'package.json'));
const boundaryUrl = pathToFileURL(join(here, 'service-boundary.mjs')).href;
async function privateFile(path, text) { await writeFile(path, text, { flag: 'wx', mode: 0o600 }); }
async function setup() {
  const path = await mkdtemp('/private/tmp/flow-svc06-boundary-'); const identity = await lstat(path);
  await mkdir(join(path, 'logs'), { mode: 0o700 });
  await privateFile(join(path, 'profile.sb'), '(version 1)\n(allow default)\n' + roots.map(p => `(deny file-read* (subpath ${JSON.stringify(p)}))`).join('\n') + '\n');
  return { path, identity };
}
async function remove(fixture, extra = {}) {
  const actual = await lstat(fixture.path); assert.equal(actual.dev, fixture.identity.dev); assert.equal(actual.ino, fixture.identity.ino);
  const checkpoint = await open(join(fixture.path, 'cleanup-checkpoint.json'), 'wx', 0o600);
  try { await checkpoint.writeFile(JSON.stringify({ dev: actual.dev, ino: actual.ino, ...extra })); await checkpoint.sync(); } finally { await checkpoint.close(); }
  const directory = await open(fixture.path, 'r'); try { await directory.sync(); } finally { await directory.close(); }
  await rm(fixture.path, { recursive: true });
  console.log(JSON.stringify({ localCleanup: 'removed', path: fixture.path, dev: actual.dev, ino: actual.ino, ...extra }));
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('trusted original identity/stop surrounds a denied child and descendant, with bounded private stderr', async () => {
  const fixture = await setup(); let record, pending, stopped = false;
  const reportPath = join(fixture.path, 'probe.json');
  try {
    const probe = `import { readFile,writeFile } from 'node:fs/promises';import { execFileSync } from 'node:child_process';\nconst paths=${JSON.stringify(paths)};const observations=[];for(const path of paths){try{await readFile(path);observations.push('allowed')}catch(e){observations.push(e.code)}}\nconst grandchild=execFileSync(process.execPath,['--input-type=module','-e',${JSON.stringify("import {readFileSync} from 'node:fs';try{readFileSync("+JSON.stringify(paths[0])+");console.log('allowed')}catch(e){console.log(e.code)}")}],{encoding:'utf8'}).trim();await writeFile(${JSON.stringify(reportPath)},JSON.stringify({observations,grandchild}),{mode:0o600,flag:'wx'});process.stderr.write('x'.repeat(65536));setInterval(()=>{},1000);`;
    await privateFile(join(fixture.path, 'probe.mjs'), probe);
    const stub = `import {installServiceBoundary} from ${JSON.stringify(boundaryUrl)};import {spawn} from 'node:child_process';const argv=[${JSON.stringify(join(fixture.path,'probe.mjs'))}];installServiceBoundary({profile:${JSON.stringify(join(fixture.path,'profile.sb'))},expected:{program:process.execPath,argv,cwd:${JSON.stringify(fixture.path)}},logDirectory:${JSON.stringify(join(fixture.path,'logs'))},captureBytes:1024});const child=spawn(process.execPath,argv,{cwd:${JSON.stringify(fixture.path)},env:{PATH:process.env.PATH},stdio:'ignore'});process.on('SIGTERM',()=>child.kill('SIGTERM'));child.once('exit',()=>{process.exitCode=0});`;
    await privateFile(join(fixture.path, 'stub.mjs'), stub);
    record = await processes.spawnOwnedProcess({ args: [join(fixture.path, 'stub.mjs')], cwd: fixture.path, env: { PATH: process.env.PATH }, onSpawn: async value => { pending = value; await privateFile(join(fixture.path, 'pending.json'), JSON.stringify(value)); } });
    const deadline = performance.now() + 4000; let observations;
    while (performance.now() < deadline) { try { observations = JSON.parse(await readFile(reportPath, 'utf8')); break; } catch (error) { if (error.code !== 'ENOENT') throw error; await wait(20); } }
    assert.deepEqual(observations, { observations: ['EPERM', 'EPERM', 'EPERM', 'EPERM'], grandchild: 'EPERM' });
    assert.equal(await processes.inspectOwnedProcess(record), 'running');
    assert.equal(record.pid, pending.pid); assert.equal(record.nonce, pending.nonce); assert.ok(record.startedAt && record.command);
    assert.equal(await processes.stopOwnedProcess(record), 'stopped'); stopped = true;
    assert.equal(await processes.inspectOwnedProcess(record), 'stopped');
    const capture = JSON.parse(await readFile(join(fixture.path, 'logs/capture.json'), 'utf8'));
    assert.equal(capture.stderr.observed, 65536); assert.equal(capture.stderr.retained, 1024); assert.equal(capture.stderr.truncated, true); assert.deepEqual(capture.errors, []);
    const log = await lstat(join(fixture.path, 'logs/stderr.private')); assert.equal(log.size, 1024); assert.equal(log.mode & 0o777, 0o600);
    console.log(JSON.stringify({ originalHelperIdentity: true, stoppedGroup: record.group, sourceDeniedPaths: paths.length, descendantDenied: true, stderrObserved: capture.stderr.observed, stderrRetained: capture.stderr.retained }));
  } finally {
    if (record && !stopped) stopped = await processes.stopOwnedProcess(record) === 'stopped';
    if (pending && !record) throw Error('UNKNOWN_PENDING_KEEP_' + fixture.path);
    if (record && !stopped) throw Error('UNKNOWN_GROUP_KEEP_' + fixture.path);
    await remove(fixture, { stoppedGroup: record?.group ?? null });
  }
});

test('mismatched runtime argv is rejected before spawning or creating captures', async () => {
  const fixture = await setup();
  try {
    const source = `import assert from 'node:assert/strict';import {installServiceBoundary} from ${JSON.stringify(boundaryUrl)};import {spawn} from 'node:child_process';const used=installServiceBoundary({profile:${JSON.stringify(join(fixture.path,'profile.sb'))},expected:{program:process.execPath,argv:['fixed.mjs'],cwd:${JSON.stringify(fixture.path)}},logDirectory:${JSON.stringify(join(fixture.path,'logs'))}});assert.throws(()=>spawn(process.execPath,['wrong.mjs'],{cwd:${JSON.stringify(fixture.path)},env:{},stdio:'ignore'}),/RUNTIME_ARGV_MISMATCH/);assert.equal(used(),false);console.log('no-spawn');`;
    await privateFile(join(fixture.path, 'mismatch.mjs'), source);
    const outcome = await execute(process.execPath, [join(fixture.path, 'mismatch.mjs')], { timeout: 4000, maxBuffer: 4096, env: { PATH: process.env.PATH } }); assert.equal(outcome.stdout.trim(), 'no-spawn'); assert.equal(outcome.stderr, '');
    await assert.rejects(lstat(join(fixture.path, 'logs/stdout.private')), { code: 'ENOENT' });
  } finally { await remove(fixture); }
});

test('sandbox start failure preserves real private stderr and numeric exit without fallback', async () => {
  const fixture = await setup();
  try {
    const source = `import {installServiceBoundary} from ${JSON.stringify(boundaryUrl)};import {spawn} from 'node:child_process';const argv=[];installServiceBoundary({profile:${JSON.stringify(join(fixture.path,'profile.sb'))},expected:{program:'/definitely-missing-svc06-node',argv,cwd:${JSON.stringify(fixture.path)}},logDirectory:${JSON.stringify(join(fixture.path,'logs'))}});const child=spawn('/definitely-missing-svc06-node',argv,{cwd:${JSON.stringify(fixture.path)},env:{PATH:process.env.PATH},stdio:'ignore'});child.once('close',(code,signal)=>console.log(JSON.stringify({code,signal})));`;
    await privateFile(join(fixture.path, 'failure.mjs'), source);
    const outcome = await execute(process.execPath, [join(fixture.path, 'failure.mjs')], { timeout: 4000, maxBuffer: 4096, env: { PATH: process.env.PATH } });
    const exit = JSON.parse(outcome.stdout); assert.notEqual(exit.code, 0); assert.equal(exit.signal, null); assert.equal(outcome.stderr, '');
    const capture = JSON.parse(await readFile(join(fixture.path, 'logs/capture.json'), 'utf8')); assert.deepEqual(capture.exit, exit); assert.ok(capture.stderr.observed > 0 && capture.stderr.retained > 0); assert.deepEqual(capture.errors, []);
  } finally { await remove(fixture); }
});
