import { PHASE_LIMITS, NATIVE_MODEL } from './permit.mjs';

export const BASE = 'f5a13cbed6b75151f34e6924ec7e10c8894acf48';
export const MATERIAL = '项目：纸鸢。版本：0.1。新增能力：草稿预览。发布状态：内部测试，尚未正式发布。';
export const REQUIREMENT = Object.freeze({
  originalGoal: '根据固定材料为纸鸢0.1准备一段简洁中文发布说明。先起草，再使用草稿与同一材料核对事实并给出最终修订稿；最终交付由独立用户判断。',
  constraints: '最多两个只读文本任务，后一步依赖前一步。不得访问未授权材料，不写文件，不调用终端、网络或子代理；不得编造日期、链接、性能承诺或新增功能。',
  acceptance: '完整包含材料的项目、版本、草稿预览与未正式发布状态，说明简洁不超过120个汉字；保留草稿与最终稿，独立审阅后才接受。',
});
export const GRAPH_TOOLS = Object.freeze(['mcp__flow-graph__graph_command', 'mcp__flow-graph__graph_read']);
// Historical O10/O08 declarations remain provenance, not a policy for every environment.
export const HISTORICAL_O10_DECLARATIONS = Object.freeze({
  plugins: Object.freeze(['cc-plugin-agents-md', 'cc-plugin-telemetry', 'cc-plugin-plugin-authoring']),
  skills: Object.freeze(['design', 'doctor', 'plugin-authoring']) });
// Exact private recipe projection from native-plan-20261007-1018/observed-init.json.
// These names convey no execution permission; model/tools/MCP/host grants stay separate.
export const DECLARATIONS = Object.freeze({ policy: 'o16-private-recipe-20261007-1018',
  model: 'claude-sonnet-5-5', runtimeVersion: '2.1.290',
  plugins: Object.freeze(['cc-plugin-agents-md', 'cc-plugin-plugin-authoring']),
  skills: Object.freeze(['doctor', 'plugin-authoring']) });
export function graphScope(baseRevision) {
  return { baseRevision, allowedExistingNodes: [], maxProposals: 1, maxApplications: 0, maxNewNodes: 2, maxNewEdges: 1,
    inputProposalProtocol: 'flow.goal-input-proposal.v1' };
}
export function planningInstruction(citation) {
  return `理解原始自然语言目标后，读取固定图并仅提出一个完整输入提案。你自己选择两项任务的标题和实际工作内容，用一条依赖连接它们；每项都提供goal、constraints、acceptance、verification和knowledge。knowledge只能使用以下固定引用：${JSON.stringify(citation)}。协议为flow.goal-input-proposal.v1。不要apply、执行child或声称交付已接受。等待owner查看实际提案后确认。`;
}
export function adapterOptions(mode, phase, materialFile) {
  if (!['rehearsal', 'native'].includes(mode) || !Object.hasOwn(PHASE_LIMITS, phase)) throw new Error('Unknown finite execution phase.');
  const limit = PHASE_LIMITS[phase];
  if (phase === 'children' && (typeof materialFile !== 'string' || !materialFile.startsWith('/'))) throw new Error('Host-owned fixed material is required.');
  return { materialFiles: phase === 'plan' ? [] : [materialFile], allowRead: phase === 'children', requireReadApproval: false,
    goalTools: false, goalGraphTools: phase === 'plan', model: mode === 'native' ? NATIVE_MODEL : 'synthetic-no-query',
    maxTurns: limit.maxTurns, maxBudgetUsd: limit.maxBudgetUsd, timeoutMs: mode === 'native' ? limit.timeoutMs : 12_000 };
}
