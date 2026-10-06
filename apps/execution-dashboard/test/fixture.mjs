import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createDashboardServer } from '../src/server.mjs';
import { validateRegistry } from '../src/registry.mjs';

export const now = Date.parse('2026-10-06T02:00:00Z');
export const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }).trim();
export function status(task, options = {}) {
  return `# ${task.id} 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近 main 同步核验 | ${options.updated ?? '2026-10-06 01:59 UTC'} / 2026-10-06 01:59 UTC |
| 单一 status owner / model | ${options.owner ?? 'owner-' + task.id} / gpt-6-astra ultra |
| Branch | ${task.branch} |
| 工作基线 / HEAD | ${options.head ?? 'f'.repeat(40)} |
| 工作树 dirty 状态 | 记录时 clean |
| 工作分支状态 | ${options.branchState ?? 'in-progress'} |
| 检查状态 | ${options.checks ?? 'NOT_RUN'} |
| 已集成 main 状态 / HEAD | ${options.mainHead ?? 'a'.repeat(40)}；${task.id} 未集成 |
| Review | review.md，${options.review ?? 'NOT_STARTED'} |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| ${task.id}-01 | ${options.todo ?? 'pending'} | owner | 尚未检查 |

## 已完成与检查

历史 F00 tests passed 不代表本 feature 检查通过。

## 阻塞 / 风险 / 未验证

${options.risks ?? '暂无新增阻塞；独立review待执行。'}

## 下一步与 handoff

${options.next ?? '完成分支交付'}

## 需要用户决定

${options.decisions ?? '无新增事项'}
`;
}

export async function fixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), 'flow-d01-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const tasks = [];
  for (const id of ['T01', 'T02']) {
    const worktree = path.join(root, id);
    await mkdir(worktree);
    git(worktree, 'init', '-q', '-b', `codex/${id.toLowerCase()}`);
    const task = { id, title: `任务 ${id}`, role: '工作线', worktree, branch: `codex/${id.toLowerCase()}`, planDir: `plans/${id.toLowerCase()}`, evidenceDir: `docs/evidence/${id.toLowerCase()}` };
    await mkdir(path.join(worktree, task.planDir), { recursive: true });
    await mkdir(path.join(worktree, task.evidenceDir), { recursive: true });
    await writeFile(path.join(worktree, task.planDir, 'status.md'), status(task));
    await writeFile(path.join(worktree, task.planDir, 'plan.md'), '# 计划\n');
    await writeFile(path.join(worktree, task.planDir, 'review.md'), '**状态：NOT_STARTED**\n');
    commit(task);
    tasks.push(task);
  }
  const mainWorktree = path.join(root, 'main');
  await mkdir(mainWorktree);
  git(mainWorktree, 'init', '-q', '-b', 'main');
  git(mainWorktree, '-c', 'user.name=D01 Test', '-c', 'user.email=d01@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'initial');
  const registry = validateRegistry({ tasks, mainWorktree, fallbackWorktree: tasks[0].worktree, frozenCommit: git(tasks[0].worktree, 'rev-parse', 'HEAD'), staleAfterHours: 24 });
  const server = createDashboardServer(registry);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { root, registry, tasks, server, url: `http://127.0.0.1:${server.address().port}`, writeStatus: (task, options) => writeFile(path.join(task.worktree, task.planDir, 'status.md'), status(task, options)) };
}
export function commit(task) {
  git(task.worktree, 'add', '.');
  git(task.worktree, '-c', 'user.name=D01 Test', '-c', 'user.email=d01@example.invalid', 'commit', '-qm', 'fixture');
  return git(task.worktree, 'rev-parse', 'HEAD');
}
