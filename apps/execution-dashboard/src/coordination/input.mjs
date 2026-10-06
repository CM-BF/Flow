import path from 'node:path';
import { realpath, lstat, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
export class ClaimError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function requireValue(condition, message) { if (!condition) throw new ClaimError('INVALID', message); }
function label(value, name) {
  requireValue(typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 160 && !/[\x00-\x1f]/.test(value), `${name} 必须是有界非空文字`);
  return value;
}
function actor(value) { return { lead: label(value?.lead, 'lead'), worker: label(value?.worker, 'worker') }; }
const git = async (directory, ...args) => (await execute('git', ['-C', directory, ...args], { timeout: 2000, maxBuffer: 65536 })).stdout.trim();
export async function location(input, repository) {
  requireValue(typeof input.worktree === 'string' && path.isAbsolute(input.worktree), 'worktree 必须为绝对路径');
  const worktree = await realpath(input.worktree);
  const branch = label(input.branch, 'branch');
  requireValue(await realpath(await git(worktree, 'rev-parse', '--show-toplevel')) === worktree, '必须登记 worktree 根目录');
  requireValue(await git(worktree, 'branch', '--show-current') === branch, 'branch 与实际 worktree 不符');
  const common = async dir => realpath(path.resolve(dir, await git(dir, 'rev-parse', '--git-common-dir')));
  requireValue(await common(worktree) === await common(repository), 'worktree 不属于协调仓库');
  return { worktree, branch };
}
export function literalScope(values) {
  requireValue(Array.isArray(values) && values.length <= 100, 'scope 必须是至多 100 项的数组');
  return [...new Set(values.map(value => {
    requireValue(typeof value === 'string' && value.length <= 512 && value === value.trim() && !/[\\*?\[\]{}\x00-\x1f]/.test(value), 'scope 必须为 literal 路径，禁止 glob');
    const normalized = value.replace(/\/$/, '');
    requireValue(normalized && !path.posix.isAbsolute(normalized) && normalized.split('/').every(part => part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git'), 'scope 禁止绝对路径、空段与 ./../');
    return normalized;
  }))].sort();
}
async function rejectSymlinks(worktree, scope) {
  for (const relative of scope) {
    let current = worktree;
    for (const segment of relative.split('/')) {
      const parent = current;
      current = path.join(current, segment);
      try {
        requireValue(!(await lstat(current)).isSymbolicLink(), 'scope 不允许 symlink，须登记真实仓库路径');
        requireValue((await readdir(parent)).includes(segment), 'scope 大小写/Unicode 拼写必须与实际仓库路径一致');
      }
      catch (error) { if (error.code === 'ENOENT') break; throw error; }
    }
  }
}
// Conservative portable conflict keys also reserve not-yet-created case/Unicode aliases.
const scopeKey = value => value.normalize('NFD').toLowerCase();
export const scopesOverlap = (left, right) => left.map(scopeKey).some(a => right.map(scopeKey).some(b => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)));
export const sameActor = (a, b) => a.lead === b.lead && a.worker === b.worker;
export async function normalizeCommand(raw, repository) {
  const command = { action: label(raw.action, 'action'), requestId: label(raw.requestId, 'requestId'), actor: actor(raw.actor) };
  requireValue(['take', 'amend', 'handoff', 'accept', 'release', 'touch'].includes(command.action), '不支持的命令');
  if (command.action === 'take') {
    requireValue(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(raw.taskId), 'taskId 格式错误');
    const role = raw.role ?? 'writer';
    requireValue(['writer', 'review', 'integration'].includes(role), 'role 格式错误');
    const scope = literalScope(raw.scope);
    requireValue(role !== 'writer' || scope.length > 0, 'writer scope 不能为空');
    requireValue(role !== 'integration' || scope.length === 0, 'integration 不授予实现写入范围');
    const place = await location(raw, repository);
    await rejectSymlinks(place.worktree, scope);
    const origin = raw.origin ?? 'new';
    requireValue(['new', 'migration'].includes(origin), 'origin 格式错误');
    requireValue(origin !== 'migration' || Number.isFinite(Date.parse(raw.observedAt)) && Date.parse(raw.observedAt) <= Date.now(), 'migration 需要原派工观察时间');
    return { ...command, taskId: raw.taskId, role, scope, ...place, origin, observedAt: origin === 'migration' ? new Date(raw.observedAt).toISOString() : null };
  }
  command.claimId = label(raw.claimId, 'claimId');
  requireValue(Number.isSafeInteger(raw.version) && raw.version > 0, 'version 必须是正整数');
  command.version = raw.version;
  if (command.action === 'amend') {
    command.scope = literalScope(raw.scope);
    if (raw.observedAt !== undefined) {
      requireValue(Number.isFinite(Date.parse(raw.observedAt)) && Date.parse(raw.observedAt) <= Date.now(), '观察时间必须是实际过去时间');
      command.observedAt = new Date(raw.observedAt).toISOString();
      command.correctionReason = label(raw.correctionReason, 'correctionReason');
    }
  }
  if (['handoff', 'release'].includes(command.action)) {
    requireValue(raw.stoppedWriting === true, '须明确 stoppedWriting=true 后才能释放或交接');
    command.stoppedWriting = true;
  }
  if (command.action === 'handoff') command.next = { ...actor(raw.next), ...await location(raw.next, repository) };
  return command;
}
export async function validateAmendedScope(claim, scope) {
  requireValue(claim.role !== 'writer' || scope.length > 0, 'writer scope 不能为空');
  requireValue(claim.role !== 'integration' || scope.length === 0, 'integration 不授予实现写入范围');
  await rejectSymlinks(claim.worktree, scope);
}
