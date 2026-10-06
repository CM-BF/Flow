import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
import { parseStatus, reviewState, todoState } from './status.mjs';
import { listDocuments, readWithinWorktree } from './documents.mjs';

const execute = promisify(execFile);
async function git(directory, args) {
  return (await execute('git', ['-C', directory, ...args], { timeout: 5000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } })).stdout.trim();
}

export async function observeGit(directory) {
  try {
    const [root, branch, head, changes] = await Promise.all([
      git(directory, ['rev-parse', '--show-toplevel']), git(directory, ['branch', '--show-current']),
      git(directory, ['rev-parse', 'HEAD']), git(directory, ['status', '--porcelain', '--untracked-files=normal']),
    ]);
    if (await realpath(root) !== await realpath(directory)) throw new Error('登记路径不是 worktree 根');
    return { available: true, branch, head, dirty: Boolean(changes), changedFiles: changes ? changes.split('\n').length : 0, observedAt: new Date().toISOString() };
  } catch (error) {
    return { available: false, branch: null, head: null, dirty: null, error: error.message.split('\n')[0], observedAt: new Date().toISOString() };
  }
}

async function statusSource(task, registry) {
  try {
    const document = await readWithinWorktree(task, `${task.planDir}/status.md`);
    return { mode: 'live', markdown: document.content.toString('utf8'), modifiedAt: document.modifiedAt };
  } catch (error) {
    try {
      const markdown = await git(registry.fallbackWorktree, ['show', `${registry.frozenCommit}:${task.planDir}/status.md`]);
      return { mode: 'frozen', markdown, modifiedAt: null, error: error.message, frozenCommit: registry.frozenCommit };
    } catch {
      return { mode: 'missing', markdown: '', modifiedAt: null, error: error.message };
    }
  }
}

async function aggregateTask(task, registry, observations, now) {
  const [source, liveGit, documents] = await Promise.all([statusSource(task, registry), observations.get(task.worktree), listDocuments(task)]);
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
  if (review.state === 'approved' && review.target !== liveGit.head) {
    review = { ...review, state: 'outdated', record: '独立 review 绑定旧提交，当前 HEAD 未获 approval。' };
  }
  const current = source.mode === 'live' && !issues.length;
  return { ...task, source: { ...source, markdown: undefined, path: `${task.worktree}/${task.planDir}/status.md`, syncedAt: new Date(now).toISOString(), stale, ageHours }, git: liveGit, status, review, documents, issues, current,
    progress: { completed: status.errors.length ? null : status.todos.filter(todo => todoState(todo.state) === 'completed').length, total: status.errors.length ? null : status.todos.length } };
}

export async function aggregate(registry, now = Date.now()) {
  const directories = [...new Set([registry.mainWorktree, ...registry.tasks.map(task => task.worktree)])];
  const observations = new Map(directories.map(directory => [directory, observeGit(directory)]));
  const [tasks, main] = await Promise.all([
    Promise.all(registry.tasks.map(task => aggregateTask(task, registry, observations, now))), observations.get(registry.mainWorktree),
  ]);
  for (const task of tasks) {
    const recordedHead = task.status.mainRecord?.match(/[a-f0-9]{40}/)?.[0];
    task.main = { record: task.status.mainRecord || '未记录 main 集成事实。', recordedHead: recordedHead ?? null, current: main.available && !main.dirty && main.branch === 'main' && recordedHead === main.head };
  }
  const milestoneSource = tasks.find(task => task.id === 'FLOW-003');
  return { generatedAt: new Date(now).toISOString(), staleAfterHours: registry.staleAfterHours, main: { ...main, worktree: registry.mainWorktree }, tasks,
    milestones: milestoneSource ? { taskId: milestoneSource.id, current: milestoneSource.current, todos: milestoneSource.status.todos } : { taskId: null, current: false, todos: [] } };
}
