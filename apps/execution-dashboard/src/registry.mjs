import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const roots = '/Users/citrine/Projects/AgentHarness/Flow-worktrees';
const assignments = [
  ['FLOW-001', '产品与技术架构', '总体计划', 'plan-status-review', 'flow-001-architecture'],
  ['FLOW-002', 'Provider 与 Harness', '技术验证', 'plan-status-review', 'flow-002-provider-harness'],
  ['FLOW-003', 'M1 执行与验收', '里程碑', 'plan-status-review', 'flow-003-m1-execution'],
  ['OPS-001', '计划状态与审查规范', '工程协作', 'plan-status-review', 'ops-001-status-review'],
  ['C01', '控制中心', '工作线', 'm1-control-plane', 'c01-control-plane', 'server'],
  ['R01', '执行 Runner', '工作线', 'm1-runner', 'r01-runner', 'runner'],
  ['R02', '原生 Harness', '工作线', 'm1-native-harness', 'r02-native-harness'],
  ['L01', '命令行', '工作线', 'm1-cli', 'l01-cli', 'cli'],
  ['W01', '产品 Web', '工作线', 'm1-web', 'w01-web', 'web'],
  ['D01', '工程进度', '工作线', 'execution-dashboard', 'd01-execution-dashboard', 'execution-dashboard'],
  ['I01', 'M1 集成验收', '工作线', 'm1-integration', 'i01-integration'],
  ['LAB01', '性能样例', '技术验证', 'performance-probes', 'lab01-performance'],
  ['LAB02', '多观察端样例', '技术验证', 'observer-probes', 'lab02-observer-probes'],
  ['D02', '进度来源同步', '工作线', 'dashboard-progress-sync', 'd02-progress-sync'],
  ['C02', '异常核对与恢复', '工作线', 'm2-reconciliation', 'c02-reconciliation'],
  ['P01', '协议互操作', '工作线', 'protocol-adapters', 'p01-protocols'],
  ['D03', '进度的人类视图', '工作线', 'dashboard-human-view', 'd03-dashboard-human'],
  ['WPF-001', 'Web 平台持续执行', '工程协作', 'web-platform-management', 'web-platform'],
  ['M02', '统一工作入口', '工作线', 'm2-workspace', 'm02-unified-workspace'],
];

export function defaultRegistry() {
  return {
    mainWorktree: '/Users/citrine/Projects/AgentHarness/Flow',
    fallbackWorktree: projectRoot,
    frozenCommit: 'eacee76fa7f1b6cc46b06b57ae68458637be4a26',
    staleAfterHours: 24,
    tasks: assignments.map(([id, title, role, directory, plan, app]) => ({
      id, title, role, worktree: path.join(roots, directory),
      branch: `codex/${directory}`, planDir: `plans/${plan}`,
      evidenceDir: `docs/evidence/${id === 'WPF-001' ? 'web-platform' : id.toLowerCase()}`,
      ...(app ? { appEvidence: `apps/${app}/EVIDENCE.md` } : {}),
    })),
  };
}

export function validateRegistry(registry) {
  if (!Array.isArray(registry.tasks) || registry.tasks.length === 0) throw new Error('登记必须包含 tasks');
  if (!path.isAbsolute(registry.mainWorktree) || !path.isAbsolute(registry.fallbackWorktree)) throw new Error('登记根路径必须为绝对路径');
  if (!/^[a-f0-9]{40}$/.test(registry.frozenCommit)) throw new Error('frozenCommit 必须为完整 SHA');
  if (!Number.isFinite(registry.staleAfterHours) || registry.staleAfterHours <= 0) throw new Error('staleAfterHours 必须大于零');
  const ids = new Set();
  for (const task of registry.tasks) {
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(task.id) || ids.has(task.id)) throw new Error('任务 ID 必须合法且唯一');
    ids.add(task.id);
    if (!path.isAbsolute(task.worktree) || !task.branch || typeof task.title !== 'string') throw new Error(`任务 ${task.id} 登记不完整`);
    if (!/^plans\/[a-z0-9-]+$/.test(task.planDir)) throw new Error(`任务 ${task.id} planDir 超出范围`);
    if (!/^docs\/evidence\/[a-z0-9-]+$/.test(task.evidenceDir)) throw new Error(`任务 ${task.id} evidenceDir 超出范围`);
    if (task.appEvidence && !/^apps\/[a-z0-9-]+\/EVIDENCE\.md$/.test(task.appEvidence)) throw new Error('appEvidence 超出范围');
  }
  return registry;
}

export async function loadRegistry(filename) {
  return validateRegistry(filename ? JSON.parse(await readFile(filename, 'utf8')) : defaultRegistry());
}
