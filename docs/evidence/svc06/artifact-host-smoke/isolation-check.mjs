// One bounded, no-PG check of the actual local checkout-read restriction.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, realpath, lstat, writeFile, open, rm, statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const execute = promisify(execFile);
const evidence = new URL('./isolation-checkpoint.json', import.meta.url);
const forbiddenRoots = ['/Users/citrine/Projects/AgentHarness/Flow', '/Users/citrine/Projects/AgentHarness/Flow-worktrees'];
const paths = forbiddenRoots.map(root => join(root, root.endsWith('Flow-worktrees') ? 'backend-release/package.json' : 'package.json'));
const forbiddenFiles = [...new Set([...paths, ...await Promise.all(paths.map(path => realpath(path))), ...paths.map(path => '/System/Volumes/Data' + path)])];
for (const path of forbiddenFiles) assert.ok((await lstat(path)).isFile());
const disk = await statfs(tmpdir());
const freeBefore = Number(disk.bavail) * Number(disk.bsize);
assert.ok(freeBefore >= 1024 ** 3 + 8 * 1024 ** 2, 'LOCAL_FREE_GATE');
let directory, identity;
const record = { startedAt: new Date().toISOString(), checks: {}, forbiddenFiles, freeBefore, provider: 0, pg: 0, serviceLaunch: 0 };
try {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'svc06-isolation-')));
  identity = await lstat(directory);
  record.owned = { directory, dev: identity.dev, ino: identity.ino };
  const profile = '(version 1)\n(allow default)\n' + [...forbiddenRoots, ...forbiddenRoots.map(path => '/System/Volumes/Data' + path)].map(path => `(deny file-read* (subpath ${JSON.stringify(path)}))`).join('\n') + '\n';
  await writeFile(join(directory, 'profile.sb'), profile, { mode: 0o600, flag: 'wx' });
  await writeFile(join(directory, 'allowed.txt'), 'owned-readable', { mode: 0o600, flag: 'wx' });
  const probe = `import assert from 'node:assert/strict';
import {open,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const paths=${JSON.stringify(forbiddenFiles)};
const results=[];
for(const path of paths){let code='READ_ALLOWED';let fd;try{fd=await open(path,'r');}catch(error){code=error.code;}finally{await fd?.close();}results.push({path,code});assert.ok(['EPERM','EACCES'].includes(code));}
assert.equal(await readFile(new URL('./allowed.txt',import.meta.url),'utf8'),'owned-readable');
const child=await promisify(execFile)(process.execPath,['--input-type=module','-e',${JSON.stringify("import {open} from 'node:fs/promises';try{const f=await open(process.argv[1],'r');await f.close();process.exitCode=2;}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;console.log(e.code);}")},paths[0]],{timeout:1500,maxBuffer:4096,env:{PATH:'/usr/bin:/bin'}});
assert.ok(['EPERM','EACCES'].includes(child.stdout.trim()));
console.log(JSON.stringify({results,ownTmpReadable:true,childInheritedDenial:true}));\n`;
  await writeFile(join(directory, 'probe.mjs'), probe, { mode: 0o600, flag: 'wx' });
  const result = await execute('/usr/bin/sandbox-exec', ['-f', join(directory, 'profile.sb'), process.execPath, join(directory, 'probe.mjs')], { cwd: directory, env: { PATH: '/usr/bin:/bin', HOME: directory, TMPDIR: directory }, timeout:5000, maxBuffer:16*1024 });
  record.checks = JSON.parse(result.stdout);
  record.stderr = result.stderr;
  record.outcome = 'PASSED_LOCAL_FILE_ISOLATION_ONLY';
} catch (error) {
  record.outcome = 'NOT_PROVEN';
  record.failure = { name: error.name, code: error.code ?? null, message: error.message, stdout: error.stdout ?? null, stderr: error.stderr ?? null };
  process.exitCode = 1;
} finally {
  record.finishedAt = new Date().toISOString();
  record.cleanup = 'pending';
  const file = await open(evidence, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(record,null,2)+'\n'); await file.sync(); } finally { await file.close(); }
  const parent = await open(new URL('./', import.meta.url), 'r'); try { await parent.sync(); } finally { await parent.close(); }
  if (directory) {
    const current = await lstat(directory);
    assert.ok(current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino, 'OWNED_IDENTITY_CHANGED');
    await rm(directory, { recursive: true });
    record.cleanup = 'own-tiny-directory-removed-after-checkpoint';
  }
  console.log(JSON.stringify(record));
}
