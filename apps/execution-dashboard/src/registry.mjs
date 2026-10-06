import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const roots = '/Users/citrine/Projects/AgentHarness/Flow-worktrees';
const assignments = [
  ['WPF-QUEUE01', '聊天待发送消息', '工作线', 'web-conversation-queue', 'wpf-queue01-ui'],
  ['K01', '项目知识原文与检索', '工作线', 'knowledge-source-store', 'k01-knowledge-sources'],
  ['WPF-PROFILEUX01', '聊天配置摘要优化', '工作线', 'web-execution-profile-summary', 'wpf-profileux-execution-summary'],
  ['SVC02', '真实预览安全更新', '工作线', 'preview-refresh', 'svc02-preview-refresh'],
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
  ['I02', 'M2 恢复与跨任务集成', '集成验证', 'm2-integration', 'i02-integration'],
  ['I01', 'M1 集成验收', '工作线', 'm1-integration', 'i01-integration'],
  ['LAB01', '性能样例', '技术验证', 'performance-probes', 'lab01-performance'],
  ['LAB02', '多观察端样例', '技术验证', 'observer-probes', 'lab02-observer-probes'],
  ['D02', '进度来源同步', '工作线', 'dashboard-progress-sync', 'd02-progress-sync'],
  ['C02', '异常核对与恢复', '工作线', 'm2-reconciliation', 'c02-reconciliation'],
  ['P01', '协议互操作', '工作线', 'protocol-adapters', 'p01-protocols'],
  ['D03', '进度的人类视图', '工作线', 'dashboard-human-view', 'd03-dashboard-human'],
  ['WPF-001', 'Web 平台持续执行', '工程协作', 'web-platform-management', 'web-platform'],
  ['WPF-M02', 'Web统一工作入口', '工作线', 'web-unified-workspace', 'wpf-m02-web-workspace'],
  ['WPF-P01', 'Web插件宿主', '工作线', 'web-plugin-host', 'wpf-p01-plugin-host'],
  ['O01', '目标与版本化执行', '工作线', 'goal-orchestration', 'o01-goal-orchestration'],
  ['WPF-PERF01', 'Web性能基线测量', '技术验证', 'web-performance', 'wpf-perf01-web-performance'],
  ['E01', 'Harness 零模型验证', '技术验证', 'harness-auth-probes', 'e01-harness-probes'],
  ['WPF-I01', 'Web 插件集成', '工作线', 'web-plugin-integration', 'wpf-i01-plugin-integration'],
  ['X01', '插件管理计划', '工作线', 'plugin-management-plan', 'x01-plugin-management'],
  ['R03', '远端Runner租约可靠性', '工作线', 'runner-reliability', 'r03-runner-reliability'],
  ['B01', '分层读取性能与界限', '技术验证', 'bounded-read-performance', 'b01-bounded-reads'],
  ['X02', '插件中心登记与命令', '工作线', 'plugin-registry', 'x02-plugin-registry'],
  ['WPF-PERF02', '活动窗口与阅读稳定', '工作线', 'web-activity-window', 'wpf-perf02-activity-window'],
  ['CHAT02', '真实助手正文事件', '工作线', 'conversation-native-events', 'chat02-native-messages'],
  ['WPF-CHAT01', '产品持续对话', '工作线', 'web-conversations', 'wpf-chat01-conversations'],
  ['CHAT01', '持久对话与回复', '工作线', 'conversation-center', 'chat01-conversations'],
  ['CHAT03', '执行选项与能力', '工作线', 'execution-profiles', 'chat03-execution-profiles'],
  ['R04', '中心有界停机', '工作线', 'center-shutdown', 'r04-center-shutdown'],
  ['P03', '外部协议传输优化', '工作线', 'protocol-payload', 'p03-protocol-payload'],
  ['X03', '插件管理视图', '工作线', 'plugin-management', 'x03-plugin-management-view'],
  ['SVC01', '个人真实聊天预览', '工作线', 'personal-preview', 'svc01-personal-preview'],
  ['CTX01', '上下文内核合成验证', '技术验证', 'context-kernel-probe', 'ctx01-context-kernel'],
  ['WPF-PROFILE01', '对话执行选项', '工作线', 'web-execution-profiles', 'wpf-profile01-execution-profiles'],
  ['O02', '原生目标工具桥接', '工作线', 'native-goal-tools', 'o02-native-goal-tools'],
  ['D06', '架构固定快照更新', '工程协作', 'dashboard-architecture-current', 'd06-architecture-refresh'],
  ['CHAT04', '持久消息队列', '工作线', 'conversation-queue', 'chat04-conversation-queue'],
  ['WPF-QUEUE00', '旧新队列能力兼容', '工作线', 'web-queue-compatibility', 'wpf-queue00-compatibility'],
  ['O03', '目标工具执行授权', '工作线', 'goal-tool-authorization', 'o03-goal-tool-authorization'],
  ['K02', '聊天知识上下文', '工作线', 'conversation-context', 'k02-conversation-context'],
  ['O07', '原生目标拆分工具', '工作线', 'native-graph-tools', 'o07-native-graph-tools'],
  ['O06', '目标拆分受限授权', '工作线', 'goal-graph-runs', 'o06-goal-graph-runs'],
  ['O05', '目标拆分提案与应用', '工作线', 'goal-graph-proposals', 'o05-goal-graph-proposals'],
  ['O04', '原生目标工具运行', '工作线', 'native-goal-execution', 'o04-native-goal-bridge'],
  ['B02', '对话读取成本测量', '技术验证', 'conversation-read-cost', 'b02-conversation-read-cost'],
  ['B03', '长对话预览读取优化', '工作线', 'bounded-conversation-preview', 'b03-bounded-preview'],
  ['D07', '下一交付与完成片段', '工程协作', 'dashboard-delivery-stage', 'd07-delivery-stage'],
  ['WPF-PROFILEI01', '聊天执行选项接入', '工作线', 'web-profile-integration', 'wpf-profile-integration'],
  ['WPF-DPERF01', '看板刷新重复核验优化', '工作线', 'dashboard-proof-performance', 'wpf-dashboard-proof-performance'],
  ['CTX02', '原生上下文插件兼容', '技术验证', 'context-pi-hook-probe', 'ctx02-pi-hook'],
  ['WPF-X03I01', '插件管理产品接线', '工作线', 'web-plugin-management-integration', 'wpf-x03-plugin-integration'],
  ['D05', '代码架构视图', '工程协作', 'dashboard-architecture', 'd05-architecture-view'],
  ['D04', '多 Lead 领取协调', '工程协作', 'dashboard-coordination', 'd04-coordination'],
  ['F01', '共享领域接口', '工作线', 'm2-shared-foundation', 'f01-shared-domains'],
  ['G01', '版本化项目计划', '工作线', 'project-graph', 'g01-project-graph'],
  ['P02', '持久外部调度', '工作线', 'protocol-dispatch', 'p02-durable-protocol'],
  ['M02', '统一工作入口', '工作线', 'm2-workspace', 'm02-unified-workspace'],
];

export function defaultRegistry() {
  return {
    mainWorktree: '/Users/citrine/Projects/AgentHarness/Flow',
    fallbackWorktree: projectRoot,
    frozenCommit: 'eacee76fa7f1b6cc46b06b57ae68458637be4a26',
    staleAfterHours: 24,
    phaseSourceId: 'FLOW-001',
    tasks: assignments.map(([id, title, role, directory, plan, app]) => ({
      id, title, role, worktree: path.join(roots, directory),
      branch: `codex/${directory}`, planDir: `plans/${plan}`,
      evidenceDir: `docs/evidence/${({ 'WPF-001': 'web-platform', 'WPF-X03I01': 'wpf-x03', 'WPF-PROFILEI01': 'wpf-profile-integration', 'WPF-PROFILEUX01': 'wpf-profileux' })[id] ?? id.toLowerCase()}`,
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
  if (registry.phaseSourceId && !ids.has(registry.phaseSourceId)) throw new Error('phaseSourceId 必须指向已登记任务');
  return registry;
}

export async function loadRegistry(filename) {
  return validateRegistry(filename ? JSON.parse(await readFile(filename, 'utf8')) : defaultRegistry());
}
