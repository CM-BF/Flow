import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { goalGraphRunAdmissionSchema } from '../../packages/contracts/src/goal-graph-runs.ts';

export const BASE = 'a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8';
export const LIMITS = Object.freeze({ queries: 1, maxTurns: 4, maxBudgetUsd: 0.20, timeoutMs: 90_000 });
export const SCOPE = Object.freeze({ baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 });
export const TITLES = ['起草发布说明', '核对事实与格式', '交付发布说明'];
export const GOAL = '为合成产品“纸鸢”0.1版本准备一份短发布说明。本版新增任务筛选，并修复标题换行问题。请先建立起草、核对、交付三个步骤的计划。';
export const CONSTRAINTS = '仅建立计划，不执行任何子任务，不访问工程文件、终端、网页、插件或子代理。只使用授予的graph工具。';
export const PROMPT = `先用graph_read读取空底稿，再用一次graph_command propose提出三个节点，标题依次为“${TITLES.join('”、“')}”，后一步依赖前一步，总共两条边。然后用返回的proposalId/proposalDigest及baseRevision调用apply一次。对同一意图保持相同idempotencyKey。最后用中文说明已记录计划、尚未执行子任务；不要声称发布说明已完成。`;
export const EXPECTED_TOOLS = ['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command'];
export function adapterOptions(mode) {
  return { materialFiles: [], allowRead: false, goalGraphTools: true, model: mode === 'native' ? 'sonnet' : 'synthetic-no-query',
    maxTurns: LIMITS.maxTurns, maxBudgetUsd: LIMITS.maxBudgetUsd, timeoutMs: mode === 'native' ? LIMITS.timeoutMs : 12_000 };
}
export function validatePlan() {
  goalGraphRunAdmissionSchema.parse({ scope: SCOPE, prompt: PROMPT, execution: { harness: 'claude' } });
  if (SCOPE.maxNewNodes !== 3 || SCOPE.maxNewEdges !== 2 || SCOPE.maxProposals !== 1 || SCOPE.maxApplications !== 1) throw new Error('Unexpected grant expansion');
}
export async function versions() {
  const load = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')).version;
  const sdk = await load('../../apps/runner/node_modules/@anthropic-ai/claude-agent-sdk/package.json');
  const mcp = await load('../../apps/runner/node_modules/@modelcontextprotocol/sdk/package.json');
  if (sdk !== '0.3.290' || mcp !== '1.32.1') throw new Error('Pinned SDK version mismatch');
  return { node: process.version, claudeSdk: sdk, mcpSdk: mcp };
}
const SOURCE_PATHS = ['config.mjs', 'guard.mjs', 'peer.mjs', 'worker.mjs', 'driver.mjs'].map(path => `experiments/native-graph-acceptance/${path}`);
const PRODUCT_PATHS = ['apps/runner/src/claude.ts', 'apps/runner/src/runtime.ts', 'apps/runner/src/execution-profiles.ts', 'apps/runner/src/goal-tool-bridge/policy.ts', 'apps/runner/src/goal-graph-tools/mcp.ts', 'apps/runner/src/goal-graph-tools/bind.ts'];
export async function sourceIdentity() {
  const root = new URL('../../', import.meta.url);
  const repository = fileURLToPath(root);
  const changed = execFileSync('git', ['diff', '--name-only', BASE, '--', 'apps', 'packages', 'package.json', 'pnpm-lock.yaml'], { cwd: repository, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'apps', 'packages', 'package.json', 'pnpm-lock.yaml'], { cwd: repository, encoding: 'utf8' }).trim();
  if (changed || dirty) throw new Error('Production input differs from the approved fixed baseline');
  const files = [];
  for (const path of [...SOURCE_PATHS, ...PRODUCT_PATHS]) {
    const data = await readFile(new URL(path, root));
    files.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  }
  return { base: BASE, files, digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'), root: repository };
}
