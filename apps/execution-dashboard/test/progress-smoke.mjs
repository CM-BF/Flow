import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { defaultRegistry, validateRegistry } from '../src/registry.mjs';
import { createDashboardServer } from '../src/server.mjs';
import { parseStatus } from '../src/status.mjs';

// This explicitly invoked check reads live worktrees; normal tests use isolated fixtures.
const registry = validateRegistry(defaultRegistry());
const ids = ['R02', 'I01', 'LAB01', 'LAB02', 'D02'];
const directory = new URL('../../../docs/evidence/d02/', import.meta.url);
const digest = content => createHash('sha256').update(content).digest('hex');
const server = createDashboardServer(registry);
const checks = { observedAt: new Date().toISOString(), node: process.version, sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tasks: [], failures: [] };
const sourceFiles = ['src/registry.mjs', 'src/server.mjs', 'src/aggregate.mjs', 'src/status.mjs', 'src/documents.mjs', 'test/progress-smoke.mjs'];
checks.sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, digest(await readFile(new URL(`../${file}`, import.meta.url)))])));
let snapshot;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}`;
  checks.url = url;
  const response = await fetch(`${url}/api/snapshot`);
  assert.equal(response.status, 200);
  snapshot = await response.json();
  for (const id of ids) {
    const registered = registry.tasks.find(task => task.id === id);
    assert.ok(registered, `${id} must be registered`);
    const task = snapshot.tasks.find(task => task.id === id);
    assert.equal(task.source.mode, 'live', `${id} must read its live owner`);
    assert.equal(task.source.path, `${registered.worktree}/${registered.planDir}/status.md`);
    assert.equal(task.git.branch, registered.branch);
    const before = await readFile(task.source.path, 'utf8');
    const document = await fetch(`${url}/api/document?${new URLSearchParams({ task: id, path: `${registered.planDir}/status.md` })}`);
    assert.equal(document.status, 200);
    const served = await document.text();
    assert.equal(served, before, `${id} document must match authoritative source`);
    assert.equal(await readFile(task.source.path, 'utf8'), before, `${id} source changed during check; rerun snapshot`);
    const parsed = parseStatus(before, id);
    assert.deepEqual(task.status, parsed, `${id} snapshot must reflect the same source revision`);
    if (parsed.errors.length) {
      assert.equal(task.current, false);
      assert.equal(task.progress.completed, null);
    }
    if (task.review.state === 'approved') assert.equal(task.review.target, task.git.head);
    checks.tasks.push({ id, path: task.source.path, sha256: digest(before), head: task.git.head, dirty: task.git.dirty,
      source: task.source.mode, current: task.current, progress: task.progress, issues: task.issues,
      main: task.main, review: task.review, checks: task.status.checks, documentMatches: true });
  }
} catch (error) { checks.failures.push(error.stack ?? String(error)); process.exitCode = 1; }
finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  checks.closed = !server.listening;
  await mkdir(directory, { recursive: true });
  if (snapshot) await writeFile(new URL('live-snapshot.json', directory), `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(new URL('live-checks.json', directory), `${JSON.stringify(checks, null, 2)}\n`);
  console.log(JSON.stringify(checks, null, 2));
}
