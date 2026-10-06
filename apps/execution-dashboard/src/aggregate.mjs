import { compareImplementation, integrationProof } from './proof.mjs';
import { assignmentSnapshot } from './coordination/ledger.mjs';
import { humanOverview } from './human.mjs';
import { resolveTaskLinks } from './task-links.mjs';
import { createGitSnapshot } from './git-snapshot.mjs';
import { realpath } from 'node:fs/promises';
import { parseStatus, reviewState, todoState } from './status.mjs';
import { listDocuments, readWithinWorktree } from './documents.mjs';

async function git(context, directory, args) {
  return (await context.execute(directory, args)).trim();
}

export async function observeGit(directory, context = createGitSnapshot()) {
  try {
    const [root, branch, head, changes] = await Promise.all([
      git(context, directory, ['rev-parse', '--show-toplevel']), git(context, directory, ['branch', '--show-current']),
      git(context, directory, ['rev-parse', 'HEAD']), git(context, directory, ['status', '--porcelain', '--untracked-files=normal']),
    ]);
    if (await realpath(root) !== await realpath(directory)) throw new Error('登记路径不是 worktree 根');
    return { available: true, branch, head, dirty: Boolean(changes), changedFiles: changes ? changes.split('\n').length : 0, observedAt: new Date().toISOString() };
  } catch (error) {
    return { available: false, branch: null, head: null, dirty: null, error: error.message.split('\n')[0], observedAt: new Date().toISOString() };
  }
}

async function statusSource(task, registry, context) {
  try {
    const document = await readWithinWorktree(task, `${task.planDir}/status.md`);
    return { mode: 'live', markdown: document.content.toString('utf8'), modifiedAt: document.modifiedAt };
  } catch (error) {
    try {
      const markdown = await git(context, registry.fallbackWorktree, ['show', `${registry.frozenCommit}:${task.planDir}/status.md`]);
      return { mode: 'frozen', markdown, modifiedAt: null, error: error.message, frozenCommit: registry.frozenCommit };
    } catch {
      return { mode: 'missing', markdown: '', modifiedAt: null, error: error.message };
    }
  }
}

async function aggregateTask(task, registry, observations, now, context) {
  const [source, liveGit, documents] = await Promise.all([statusSource(task, registry, context), observations.get(task.worktree), listDocuments(task)]);
  let status;
  try { status = parseStatus(source.markdown, task.id); }
  catch (error) { status = { errors: [`状态解析失败：${error.message}`], todos: [], owner: '', checks: { state: 'unknown', record: '状态解析失败' } }; }
  let review;
  try { review = reviewState((await readWithinWorktree(task, `${task.planDir}/review.md`)).content.toString('utf8'), status.reviewRecord); }
  catch { review = { state: 'unknown', record: 'review 文件缺失或不可读取。', target: null }; }
  const issues = [...status.errors];
  if (source.mode !== 'live') issues.unshift(source.mode === 'frozen' ? '权威 status 不可读取；仅展示冻结基线旧记录，当前进度未知。' : '权威 status 缺失，当前进度未知。');
  if (!liveGit.available) issues.push('无法观察权威 worktree 的 Git 状态。');
  if (liveGit.available && liveGit.branch !== task.branch) issues.push(`登记分支 ${task.branch} 与当前分支 ${liveGit.branch || '(detached)'} 冲突。`);
  if (status.branch && status.branch !== task.branch) issues.push('status 声明分支与派工登记冲突。');
  const ageHours = status.updatedAt ? (now - Date.parse(status.updatedAt)) / 3600000 : null;
  const stale = ageHours === null || ageHours > registry.staleAfterHours || ageHours < -0.1;
  if (stale) issues.push(ageHours < 0 ? 'status 更新时间在未来，需核对时钟。' : `status 未同步或超过 ${registry.staleAfterHours} 小时，当前进度待核实。`);
  const implementationProof = status.implementation && liveGit.available ? await compareImplementation(task.worktree, status.implementation.target, liveGit.head, status.implementation, context) : { state: 'unknown', reason: '来源不可核验' };
  if (review.state === 'approved') {
    const proof = status.implementation && liveGit.available
      ? review.target && review.target === status.implementation.target
        ? implementationProof
        : await compareImplementation(task.worktree, review.target, liveGit.head, status.implementation, context)
      : { state: 'unknown', reason: '实现范围未知' };
    let state = 'unknown';
    if (proof.state === 'unchanged' && implementationProof.state === 'unchanged') state = 'approved';
    else if (proof.state === 'changed' || implementationProof.state === 'changed') state = 'outdated';
    review = { ...review, proof, declarationProof: implementationProof.state, state };
  }
  const current = source.mode === 'live' && !issues.length;
  return { ...task, source: { ...source, markdown: undefined, path: `${task.worktree}/${task.planDir}/status.md`, syncedAt: new Date(now).toISOString(), stale, ageHours }, git: liveGit, status, review, implementationProof, documents, issues, current,
    progress: { completed: status.errors.length ? null : status.todos.filter(todo => todoState(todo.state) === 'completed').length, total: status.errors.length ? null : status.todos.length } };
}

export async function aggregate(registry, now = Date.now(), context = createGitSnapshot()) {
  const directories = [...new Set([registry.mainWorktree, ...registry.tasks.map(task => task.worktree)])];
  const observations = new Map(directories.map(directory => [directory, observeGit(directory, context)]));
  const [tasks, main, assignments] = await Promise.all([
    Promise.all(registry.tasks.map(task => aggregateTask(task, registry, observations, now, context))), observations.get(registry.mainWorktree), assignmentSnapshot(undefined, now),
  ]);
  await Promise.all(tasks.map(async task => { task.main = await integrationProof(task, registry.mainWorktree, main, context); }));
  for (const task of tasks) task.assignments = assignments.state === 'available' ? assignments.claims.filter(claim => claim.taskId === task.id && claim.state !== 'released').map(claim => ({ ...claim, matchesSource: claim.worktree === task.worktree && claim.branch === task.branch })) : null;
  const links = resolveTaskLinks(tasks);
  for (const task of tasks) task.links = links.get(task.id);
  const registered = new Set(tasks.map(task => task.id));
  const unregisteredAssignments = assignments.claims.filter(claim => claim.state !== 'released' && !registered.has(claim.taskId));
  const milestoneSource = tasks.find(task => task.id === 'FLOW-003');
  return { generatedAt: new Date(now).toISOString(), staleAfterHours: registry.staleAfterHours, main: { ...main, worktree: registry.mainWorktree }, tasks, assignments, unregisteredAssignments, overview: humanOverview(tasks, registry.phaseSourceId),
    milestones: milestoneSource ? { taskId: milestoneSource.id, current: milestoneSource.current, todos: milestoneSource.status.todos } : { taskId: null, current: false, todos: [] } };
}
