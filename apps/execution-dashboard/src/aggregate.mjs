import { compareImplementation, integrationProof } from './proof.mjs';
import { readStatusSource, statusObservation, statusDigest, sourceKey, registryFingerprint, observeAssignments, matchAssignments } from './read-model.mjs';
import { humanOverview } from './human.mjs';
import { resolveTaskLinks } from './task-links.mjs';
import { createGitSnapshot } from './git-snapshot.mjs';
import { realpath } from 'node:fs/promises';
import { reviewState } from './status.mjs';
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

async function aggregateTask(task, registry, observations, now, context, includeDigest = false) {
  const [source, liveGit, documents] = await Promise.all([readStatusSource(task, registry, context), observations.get(task.worktree), listDocuments(task)]);
  const { status, issues, ageHours, stale, progress } = statusObservation(task, registry, source, now, liveGit);
  let review;
  try { review = reviewState((await readWithinWorktree(task, `${task.planDir}/review.md`)).content.toString('utf8'), status.reviewRecord); }
  catch { review = { state: 'unknown', record: 'review 文件缺失或不可读取。', target: null }; }
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
  return { ...task, source: { ...source, ...(includeDigest ? { digest: statusDigest(source) } : {}), markdown: undefined, path: `${task.worktree}/${task.planDir}/status.md`, syncedAt: new Date(now).toISOString(), stale, ageHours }, git: liveGit, status, review, implementationProof, documents, issues, current,
    progress };
}

export async function aggregate(registry, now = Date.now(), context = createGitSnapshot(), assignmentObserver = observeAssignments) {
  const directories = [...new Set([registry.mainWorktree, ...registry.tasks.map(task => task.worktree)])];
  const observations = new Map(directories.map(directory => [directory, observeGit(directory, context)]));
  const [tasks, main, assignments] = await Promise.all([
    Promise.all(registry.tasks.map(task => aggregateTask(task, registry, observations, now, context))), observations.get(registry.mainWorktree), assignmentObserver(now),
  ]);
  await Promise.all(tasks.map(async task => { task.main = await integrationProof(task, registry.mainWorktree, main, context); }));
  const { byTask, unregisteredAssignments } = matchAssignments(registry, assignments);
  for (const task of tasks) task.assignments = byTask[task.id];
  const links = resolveTaskLinks(tasks);
  for (const task of tasks) task.links = links.get(task.id);
  const milestoneSource = tasks.find(task => task.id === 'FLOW-003');
  return { generatedAt: new Date(now).toISOString(), staleAfterHours: registry.staleAfterHours, main: { ...main, worktree: registry.mainWorktree }, tasks, assignments, unregisteredAssignments, overview: humanOverview(tasks, registry.phaseSourceId),
    milestones: milestoneSource ? { taskId: milestoneSource.id, current: milestoneSource.current, todos: milestoneSource.status.todos } : { taskId: null, current: false, todos: [] } };
}

/** Selected task and main only. Every invocation owns a new Git context by default. */
export async function readTaskDetail(registry, id, now = Date.now(), context = createGitSnapshot()) {
  const registered = registry.tasks.find(task => task.id === id);
  if (!registered) throw new Error('任务未登记');
  const startedAt = new Date(now).toISOString();
  const before = await readStatusSource(registered, registry, context);
  const directories = [...new Set([registered.worktree, registry.mainWorktree])];
  const observations = new Map(directories.map(directory => [directory, observeGit(directory, context)]));
  const [task, main] = await Promise.all([aggregateTask(registered, registry, observations, now, context, true), observations.get(registry.mainWorktree)]);
  task.main = await integrationProof(task, registry.mainWorktree, main, context);
  const after = await readStatusSource(registered, registry, context);
  const statusDigestBefore = statusDigest(before), statusDigestAfter = statusDigest(after);
  // Also bind the status actually used by aggregateTask, not just equal bookends (A→B→A).
  const observedDigest = task.source.digest;
  const consistency = before.mode !== 'live' || after.mode !== 'live' || task.source.mode !== 'live' ? 'unknown'
    : statusDigestBefore === statusDigestAfter && observedDigest === statusDigestBefore ? 'matched' : 'changed';
  delete task.source.digest;
  return { kind: 'task-detail', version: 1, generatedAt: startedAt, taskId: id, sourceKey: sourceKey(registered), registryFingerprint: registryFingerprint(registry),
    startedAt, completedAt: new Date().toISOString(), statusDigestBefore, statusDigestAfter, consistency, task,
    mainObservation: { ...main, worktree: registry.mainWorktree } };
}
