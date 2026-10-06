import { createHash, randomUUID } from 'node:crypto';
import { readWithinWorktree, documentLimit } from './documents.mjs';
import { parseStatus, todoState } from './status.mjs';
import { humanOverview } from './human.mjs';
import { resolveTaskLinks } from './task-links.mjs';
import { createGitSnapshot } from './git-snapshot.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const timestamp = value => new Date(value).toISOString();
export const sourceKey = task => digest(JSON.stringify([task.id, task.worktree, task.branch, task.planDir, task.evidenceDir]));
export const registryFingerprint = registry => digest(JSON.stringify({
  tasks: registry.tasks.map(task => [sourceKey(task), task.title, task.role, task.appEvidence]),
  main: registry.mainWorktree, fallback: registry.fallbackWorktree, frozen: registry.frozenCommit,
  stale: registry.staleAfterHours, phase: registry.phaseSourceId,
}));

/** Only the unavailable live source uses Git; a normal summary never observes a repository. */
export async function readStatusSource(task, registry, context = createGitSnapshot()) {
  try {
    const document = await readWithinWorktree(task, `${task.planDir}/status.md`);
    if (document.content.length > documentLimit) throw new Error('status 读取期间超过 2 MiB');
    return { mode: 'live', markdown: document.content.toString('utf8'), modifiedAt: document.modifiedAt };
  } catch (error) {
    try {
      const markdown = (await context.execute(registry.fallbackWorktree, ['show', `${registry.frozenCommit}:${task.planDir}/status.md`])).trim();
      if (Buffer.byteLength(markdown) > documentLimit) throw new Error('冻结 status 超过 2 MiB');
      return { mode: 'frozen', markdown, modifiedAt: null, error: error.message, frozenCommit: registry.frozenCommit };
    } catch {
      return { mode: 'missing', markdown: '', modifiedAt: null, error: error.message };
    }
  }
}

export function statusDigest(source) { return source.mode === 'missing' ? null : digest(source.markdown); }

/** Shared declaration rules. Supplying liveGit adds the original full snapshot checks in order. */
export function statusObservation(task, registry, source, now, liveGit) {
  let status;
  try { status = parseStatus(source.markdown, task.id); }
  catch (error) { status = { errors: [`状态解析失败：${error.message}`], todos: [], owner: '', checks: { state: 'unknown', record: '状态解析失败' } }; }
  const issues = [...status.errors];
  if (source.mode !== 'live') issues.unshift(source.mode === 'frozen' ? '权威 status 不可读取；仅展示冻结基线旧记录，当前进度未知。' : '权威 status 缺失，当前进度未知。');
  if (liveGit) {
    if (!liveGit.available) issues.push('无法观察权威 worktree 的 Git 状态。');
    if (liveGit.available && liveGit.branch !== task.branch) issues.push(`登记分支 ${task.branch} 与当前分支 ${liveGit.branch || '(detached)'} 冲突。`);
  }
  if (status.branch && status.branch !== task.branch) issues.push('status 声明分支与派工登记冲突。');
  const ageHours = status.updatedAt ? (now - Date.parse(status.updatedAt)) / 3600000 : null;
  const stale = ageHours === null || ageHours > registry.staleAfterHours || ageHours < -0.1;
  if (stale) issues.push(ageHours < 0 ? 'status 更新时间在未来，需核对时钟。' : `status 未同步或超过 ${registry.staleAfterHours} 小时，当前进度待核实。`);
  const progress = { completed: status.errors.length ? null : status.todos.filter(todo => todoState(todo.state) === 'completed').length, total: status.errors.length ? null : status.todos.length };
  return { status, issues, stale, ageHours, progress, sourceCurrent: source.mode === 'live' && !issues.length };
}

async function mapSources(tasks, read) {
  const values = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, tasks.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      values[index] = await read(tasks[index]);
    }
  }));
  return values;
}

function summarizeDeclarations(status) {
  const truncatedFields = [];
  const text = (key, value, limit = 512) => {
    if (!value || value.length <= limit) return value;
    truncatedFields.push(key); return `${value.slice(0, limit)}…（完整记录见详情）`;
  };
  const human = status.human ? { ...status.human,
    output: text('human.output', status.human.output, 240), next: text('human.next', status.human.next, 240),
  } : undefined;
  return { owner: text('owner', status.owner), branch: text('branch', status.branch), branchState: text('branchState', status.branchState),
    declaredHead: text('declaredHead', status.declaredHead), declaredDirty: text('declaredDirty', status.declaredDirty), updatedRecord: text('updatedRecord', status.updatedRecord),
    checks: { ...status.checks, record: text('checks.record', status.checks.record) },
    reviewRecord: text('reviewRecord', status.reviewRecord), mainRecord: text('mainRecord', status.mainRecord), human, truncatedFields };
}

/** Status declarations, not a smaller full/proven snapshot. */
export async function readSummary(registry, now = Date.now(), context = createGitSnapshot()) {
  const startedAt = timestamp(now);
  const records = await mapSources(registry.tasks, async task => {
    const source = await readStatusSource(task, registry, context);
    return { task, source, ...statusObservation(task, registry, source, now) };
  });
  // These legacy projections exist only inside the pure relation/overview algorithms.
  const projections = records.map(record => ({ ...record.task, status: record.status, current: record.sourceCurrent, source: { mode: record.source.mode, stale: record.stale } }));
  const links = resolveTaskLinks(projections);
  for (const task of projections) task.links = links.get(task.id);
  const tasks = records.map(({ task, source, status, issues, stale, ageHours, progress, sourceCurrent }) => ({
    id: task.id, title: task.title, role: task.role, sourceKey: sourceKey(task), sourceCurrent,
    source: { mode: source.mode, digest: statusDigest(source), modifiedAt: source.modifiedAt, readAt: startedAt,
      declaredUpdatedAt: status.updatedAt ?? null, stale, ageHours, issues, error: source.error ?? null, frozenCommit: source.frozenCommit ?? null },
    declarations: summarizeDeclarations(status),
    progress, links: { ...links.get(task.id), basis: 'status-source' },
    verification: { state: 'not_loaded' }, assignment: { state: 'pending' },
  }));
  const milestone = records.find(record => record.task.id === 'FLOW-003');
  return {
    kind: 'summary', version: 1, readId: randomUUID(), registryFingerprint: registryFingerprint(registry), startedAt, completedAt: timestamp(Date.now()), staleAfterHours: registry.staleAfterHours,
    tasks, overview: { ...humanOverview(projections, registry.phaseSourceId), basis: 'status-source' },
    milestones: { basis: 'status-source', taskId: milestone?.task.id ?? null, sourceCurrent: milestone?.sourceCurrent ?? false,
      todos: milestone?.status.todos.map(({ id, state, owner }) => ({ id, state, owner })) ?? [] },
  };
}

/** The sole authority remains the original ledger; importing it is deferred until requested. */
export async function observeAssignments(now = Date.now()) {
  try {
    const { assignmentSnapshot } = await import('./coordination/ledger.mjs');
    return await assignmentSnapshot(undefined, now);
  } catch (error) {
    return { state: 'unknown', observedAt: timestamp(now), claims: [], reason: `领取账本不可读取：${error.message.split('\n')[0]}` };
  }
}

export function matchAssignments(registry, assignments) {
  const registered = new Set(registry.tasks.map(task => task.id));
  const byTask = Object.fromEntries(registry.tasks.map(task => [task.id, assignments.state === 'available'
    ? assignments.claims.filter(claim => claim.taskId === task.id && claim.state !== 'released').map(claim => ({ ...claim, matchesSource: claim.worktree === task.worktree && claim.branch === task.branch })) : null]));
  return { byTask, unregisteredAssignments: assignments.claims.filter(claim => claim.state !== 'released' && !registered.has(claim.taskId)) };
}

export async function readAssignments(registry, now = Date.now(), observer = observeAssignments) {
  let assignments;
  try { assignments = await observer(now); }
  catch (error) { assignments = { state: 'unknown', observedAt: timestamp(now), claims: [], reason: error.message }; }
  return { kind: 'assignments', version: 1, registryFingerprint: registryFingerprint(registry), readId: randomUUID(),
    startedAt: timestamp(now), completedAt: timestamp(Date.now()), assignments, ...matchAssignments(registry, assignments) };
}
