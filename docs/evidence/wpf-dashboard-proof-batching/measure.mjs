import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const aggregateUrl = new URL('../../../apps/execution-dashboard/src/aggregate.mjs', import.meta.url).href;
const label = process.argv[2];
if (!['baseline', 'after'].includes(label) || existsSync(path.join(evidence, `${label}.json`))) throw new Error('Use a new authorized baseline/after label; never overwrite observations');
const started = performance.now();
const prior = label === 'after' ? JSON.parse(await readFile(path.join(evidence, 'baseline.json'), 'utf8')) : null;
const priorMilliseconds = prior?.totalMillisecondsIncludingCleanup ?? 0;
const ceiling = 32 * 1024 * 1024;
const report = { label, priorMilliseconds, startedAt: new Date().toISOString(), node: process.version, limitSeconds: 60, evidenceLimitBytes: ceiling, sourceCounts: [16, 64, 128], samples: [], productChanges: label === 'after', serviceOrDatabaseAccess: false };
let temporary;
let evidenceBytes = prior?.evidenceBytes ?? 0;
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
delete env.FLOW_COORDINATION_DATABASE_URL;
delete env.FLOW_COORDINATION_REPO;
delete env.GIT_TRACE2_EVENT;
const remaining = () => 50000 - priorMilliseconds - (performance.now() - started);
function git(directory, ...args) {
  if (remaining() < 1000) throw new Error('Experiment work deadline reached; reserve cleanup time');
  return execFileSync('git', ['-C', directory, ...args], { env, encoding: 'utf8', timeout: Math.min(5000, remaining()), maxBuffer: 2 * 1024 * 1024 }).trim();
}
function status(id, branch, target, scopes) {
  return `# ${id} 状态\n\n| 字段 | 记录 |\n| --- | --- |\n| 最近更新时间 UTC | ${new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')} |\n| 单一status owner / model | synthetic / gpt-6-astra |\n| Branch | ${branch} |\n| 工作分支状态 | completed |\n| 已集成main状态 / HEAD | ${target} |\n| 实现目标 | ${target} |\n| 实现范围 | ${scopes.join(', ')} |\n| 检查状态 | PASSED ${target} |\n| Review | APPROVED ${target} |\n| 阶段 | M2 |\n| 优先级 | 3 |\n| 当前产出 | 合成来源 |\n| 下一可用交付 | 临时测量 |\n| 当前阻塞 | NONE |\n| 需用户决定 | NONE |\n\n| TODO ID | 状态 | Owner | 完成证据/检查 |\n| --- | --- | --- | --- |\n| ${id}-01 | completed | synthetic | fixture |\n`;
}
async function snapshot(registry, tracePath, timeout) {
  const code = `import{aggregate}from ${JSON.stringify(aggregateUrl)}; const s=await aggregate(JSON.parse(process.argv[1])); console.log(JSON.stringify({tasks:s.tasks.length, current:s.tasks.filter(t=>t.current).length,unchanged:s.tasks.filter(t=>t.implementationProof.state==='unchanged').length,approved:s.tasks.filter(t=>t.review.state==='approved').length,integrated:s.tasks.filter(t=>t.main.current).length,assignmentState:s.assignments.state,issues:s.tasks.flatMap(t=>t.issues),reasons:s.tasks.filter(t=>t.implementationProof.state!=='unchanged'||!t.main.current).map(t=>({id:t.id,proof:t.implementationProof.reason,main:t.main.reason}))}));`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(registry)], { env: { ...env, GIT_TRACE2_EVENT: tracePath }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', failure;
    const kill = reason => { failure ??= reason; try { process.kill(-child.pid, 'SIGKILL'); } catch {} };
    const timer = setTimeout(() => kill('snapshot work deadline'), timeout);
    const monitor = setInterval(async () => { try { if ((await stat(tracePath)).size + evidenceBytes > ceiling - 1048576) kill('Trace2 evidence ceiling'); } catch {} }, 100);
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 1048576) kill('bounded stdout exceeded'); });
    child.stderr.on('data', data => { stderr += data; if (stderr.length > 1048576) kill('bounded stderr exceeded'); });
    child.once('error', error => { failure = error.message; });
    child.once('close', code => { clearTimeout(timer); clearInterval(monitor); if (failure || code !== 0) reject(new Error(failure ?? `snapshot exit ${code}: ${stderr.slice(0, 300)}`)); else resolve(JSON.parse(stdout)); });
  });
}
function traceSummary(trace) {
  const events = trace.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const starts = events.filter(event => event.event === 'start');
  const sessions = new Set(starts.map(event => event.sid));
  const lifecycle = events.filter(event => sessions.has(event.sid) && ['start', 'exit'].includes(event.event)).sort((a, b) => a.time.localeCompare(b.time));
  let active = 0, peak = 0;
  for (const event of lifecycle) { active += event.event === 'start' ? 1 : -1; peak = Math.max(peak, active); }
  const commands = {};
  for (const { argv } of starts) { const name = argv[3]; commands[name] = (commands[name] ?? 0) + 1; }
  return { gitStarts: starts.length, peakGitProcesses: peak, remainingGitProcesses: active, commands, traceSha256: createHash('sha256').update(trace).digest('hex') };
}
try {
  report.aggregateSha256 = createHash('sha256').update(await readFile(path.join(root, 'apps/execution-dashboard/src/aggregate.mjs'))).digest('hex');
  report.proofSha256 = createHash('sha256').update(await readFile(path.join(root, 'apps/execution-dashboard/src/proof.mjs'))).digest('hex');
  temporary = await mkdtemp(path.join(tmpdir(), 'flow-dperf02-'));
  const main = path.join(temporary, 'main'), worker = path.join(temporary, 'worker');
  await mkdir(main);
  git(main, 'init', '-q', '-b', 'main');
  const scopes = ['src/shared', 'src/shared/a.txt', 'src/second', 'src/third.txt', 'src/fourth.txt'];
  for (const file of ['src/shared/a.txt', 'src/shared/b.txt', 'src/second/c.txt', 'src/third.txt', 'src/fourth.txt']) { await mkdir(path.dirname(path.join(main, file)), { recursive: true }); await writeFile(path.join(main, file), `synthetic ${file}\n`); }
  git(main, 'add', '.'); git(main, '-c', 'user.name=DPERF fixture', '-c', 'user.email=dperf@example.invalid', 'commit', '-qm', 'fixed synthetic sources');
  const target = git(main, 'rev-parse', 'HEAD');
  for (let i = 0; i < 128; i++) {
    const id = `T${String(i).padStart(3, '0')}`, dir = path.join(main, 'plans', id.toLowerCase());
    await mkdir(dir, { recursive: true });
    // Every synthetic source points at the one worker branch; main is a separate worktree.
    await writeFile(path.join(dir, 'status.md'), status(id, 'codex/fixture', target, scopes));
    await writeFile(path.join(dir, 'plan.md'), `# ${id}\n`);
    await writeFile(path.join(dir, 'review.md'), `**状态：APPROVED**\nReview target commit：${target}\n`);
  }
  git(main, 'add', '.'); git(main, '-c', 'user.name=DPERF fixture', '-c', 'user.email=dperf@example.invalid', 'commit', '-qm', 'synthetic status declarations');
  git(main, 'worktree', 'add', '-q', '-b', 'codex/fixture', worker, 'HEAD');
  report.fixture = { repositories: 1, worktrees: 2, scopes, distinctSourceFiles: 5, immutableTarget: target, note: 'synthetic registration only; not runner/provider capacity' };
  for (const count of report.sourceCounts) {
    if (remaining() < 3000) throw new Error('Insufficient remaining experiment budget');
    const registry = { mainWorktree: main, fallbackWorktree: worker, frozenCommit: target, staleAfterHours: 24, phaseSourceId: 'T000', tasks: Array.from({ length: count }, (_, i) => { const id = `T${String(i).padStart(3, '0')}`; return { id, title: id, role: '工作线', worktree: worker, branch: 'codex/fixture', planDir: `plans/${id.toLowerCase()}`, evidenceDir: `docs/evidence/${id.toLowerCase()}` }; }) };
    const tracePath = path.join(temporary, `trace-${count}.jsonl`), begin = performance.now();
    const result = await snapshot(registry, tracePath, Math.min(20000, remaining()));
    const milliseconds = performance.now() - begin, trace = await readFile(tracePath, 'utf8');
    evidenceBytes += Buffer.byteLength(trace);
    if (evidenceBytes > ceiling - 1048576) throw new Error('Evidence budget exceeded');
    await writeFile(path.join(evidence, `${label}-${count}.trace.jsonl`), trace);
    const sample = { count, milliseconds, ...traceSummary(trace), result };
    report.samples.push(sample);
    if (result.unchanged !== count || result.approved !== count || result.integrated !== count || result.current !== count || sample.remainingGitProcesses !== 0) throw new Error('Synthetic snapshot semantics failed; stop experiment');
  }
  report.state = 'completed';
} catch (error) { report.state = 'stopped'; report.error = error.message; }
finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
  report.cleaned = true;
  report.totalMillisecondsIncludingCleanup = performance.now() - started;
  report.evidenceBytes = evidenceBytes;
  report.finishedAt = new Date().toISOString();
  report.combinedMillisecondsIncludingCleanup = priorMilliseconds + report.totalMillisecondsIncludingCleanup;
  report.withinBudget = report.combinedMillisecondsIncludingCleanup <= 60000 && evidenceBytes < ceiling;
  await writeFile(path.join(evidence, `${label}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
