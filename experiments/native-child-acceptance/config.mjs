import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MANAGED_BASELINE } from '../native-graph-acceptance/config.mjs';
export { MANAGED_BASELINE };
export const BASE = 'fc113945ff73d1a43092d0a70b51e901aa4be1e2';
export const LIMITS = Object.freeze({ queries: 1, maxTurns: 3, maxBudgetUsd: 0.10, timeoutMs: 60_000 });
export const MATERIAL = '项目：纸鸢。版本：0.1。新增能力：草稿预览。发布状态：内部测试，尚未正式发布。';
export const INPUT = Object.freeze({ goal: '读取唯一授权材料，为纸鸢 0.1 写一段不超过 120 个汉字的中文发布说明草稿。',
  constraints: '仅采用授权材料中的事实；明确仍为内部测试且尚未正式发布；不得补充日期、链接、性能承诺或其他功能；只返回正文，不写文件、不调用其他工具。',
  acceptance: '人工核对项目、版本、草稿预览及未正式发布四项事实；文字简洁，无材料之外的承诺。', verification: { kind: 'contains', expected: '纸鸢' } });
export const SYNTHETIC_FINAL = '纸鸢 0.1 新增草稿预览，目前处于内部测试阶段，尚未正式发布。';
export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
export function adapterOptions(mode, material) {
  return { materialFiles: [material], allowRead: true, requireReadApproval: false, goalTools: false, goalGraphTools: false,
    model: mode === 'native' ? 'sonnet' : 'synthetic-no-query', maxTurns: LIMITS.maxTurns, maxBudgetUsd: LIMITS.maxBudgetUsd, timeoutMs: LIMITS.timeoutMs };
}
export const SOURCE_PATHS = ['config.mjs', 'guard.mjs', 'worker.mjs', 'driver.mjs', 'facts.mjs'].map(p => `experiments/native-child-acceptance/${p}`);
export const DEPENDENCY_PATHS = [
  'experiments/native-graph-acceptance/driver.mjs', 'experiments/native-graph-acceptance/guard.mjs', 'experiments/native-graph-acceptance/config.mjs', 'experiments/native-graph-acceptance/peer.mjs',
  'apps/runner/src/claude.ts', 'apps/runner/src/runtime.ts', 'apps/runner/src/execution-profiles.ts', 'apps/runner/src/outbox.ts',
  'apps/server/src/index.ts', 'apps/server/src/goal-native-executions/index.ts', 'apps/server/src/goal-native-executions/store.ts',
  'apps/server/src/goals/commands.ts', 'packages/contracts/src/goal-native-executions.ts', 'packages/client/src/index.ts', 'pnpm-lock.yaml',
];
export async function sourceIdentity() {
  const root = new URL('../../', import.meta.url), repository = fileURLToPath(root);
  const scopes = ['apps', 'packages', 'package.json', 'pnpm-lock.yaml', 'experiments/native-graph-acceptance'];
  if (execFileSync('git', ['diff', '--name-only', BASE, '--', ...scopes], { cwd: repository, encoding: 'utf8' }).trim()
    || execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...scopes], { cwd: repository, encoding: 'utf8' }).trim()) throw new Error('Fixed product or helper source changed');
  const files = [];
  for (const path of [...SOURCE_PATHS, ...DEPENDENCY_PATHS]) { const data = await readFile(new URL(path, root)); files.push({ path, bytes: data.length, sha256: digest(data) }); }
  return { base: BASE, root: repository, files, digest: digest(JSON.stringify(files)) };
}
export async function versions() {
  const sdk = JSON.parse(await readFile(new URL('../../apps/runner/node_modules/@anthropic-ai/claude-agent-sdk/package.json', import.meta.url), 'utf8')).version;
  if (sdk !== '0.3.290') throw new Error('Unexpected installed SDK');
  return { node: process.version, claudeSdk: sdk };
}
