import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const fullSha = /^[a-f0-9]{40}$/;
async function git(directory, ...args) {
  return (await execute('git', ['-C', directory, ...args], { timeout: 5000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } })).stdout;
}
const pathsFrom = value => value.split('\0').filter(Boolean);
const covers = (scopes, file) => scopes.some(scope => file === scope || file.startsWith(`${scope}/`));
const metadata = file => /^(plans|docs)\/.+\.(md|json|txt|log|patch|png|jpg|jpeg|webp)$/.test(file) || /^(AGENTS|README)\.md$/.test(file);

export function parseImplementation(target, record) {
  const scopes = record.replace(/`/g, '').split(/[,，]/).map(item => item.trim().replace(/\/$/, '')).filter(Boolean);
  const errors = [];
  if (!fullSha.test(target)) errors.push('实现目标需完整 SHA');
  if (!scopes.length || scopes.length > 128) errors.push('实现范围缺失或过多');
  if (scopes.some(scope => !/^[a-zA-Z0-9_.\-/]+$/.test(scope) || scope.startsWith('/') || scope.split('/').some(part => !part || part === '.' || part === '..' || part === '.git'))) errors.push('实现范围必须为仓库相对 literal 路径，不允许通配符或越界');
  return { target: fullSha.test(target) ? target : null, scopes: [...new Set(scopes)], errors };
}

async function tree(directory, target, scopes) {
  if ((await git(directory, 'cat-file', '-t', target)).trim() !== 'commit') throw new Error('目标不是 commit');
  const entries = [];
  for (const scope of scopes) {
    const files = pathsFrom(await git(directory, 'ls-tree', '-r', '-z', '--full-tree', target, '--', `:(literal)${scope}`));
    if (!files.length) throw new Error(`目标中不存在实现路径：${scope}`);
    entries.push(...files);
  }
  return [...new Set(entries)].sort().join('\0');
}

export async function compareImplementation(directory, target, head, implementation) {
  const base = { target, head, scopes: implementation.scopes, observedAt: new Date().toISOString() };
  if (!fullSha.test(target ?? '') || implementation.errors.length) return { ...base, state: 'unknown', reason: implementation.errors.join('；') || '缺少完整目标 SHA' };
  try {
    await tree(directory, target, implementation.scopes);
    const [committed, dirty, untracked] = await Promise.all([
      git(directory, 'diff', '--name-only', '-z', '--no-renames', target, head, '--'),
      git(directory, 'diff', '--name-only', '-z', '--no-renames', 'HEAD', '--'),
      git(directory, 'ls-files', '--others', '--exclude-standard', '-z'),
    ]);
    const changed = [...new Set([...pathsFrom(committed), ...pathsFrom(dirty), ...pathsFrom(untracked)])];
    const implementationChanges = changed.filter(file => covers(implementation.scopes, file));
    const outsideChanges = changed.filter(file => !covers(implementation.scopes, file) && !metadata(file));
    const state = implementationChanges.length ? 'changed' : outsideChanges.length ? 'unknown' : 'unchanged';
    return { ...base, state, implementationChanges, outsideChanges, metadataChanges: changed.filter(file => !covers(implementation.scopes, file) && metadata(file)), reason: state === 'changed' ? '声明实现范围已有变化' : state === 'unknown' ? '范围外存在非 metadata 变化，需 owner 核对实现范围' : '声明范围未变；其余变化仅为已识别的文档或证据 metadata' };
  } catch (error) { return { ...base, state: 'unknown', reason: error.message.split('\n')[0] }; }
}

export async function integrationProof(task, mainDirectory, main) {
  const declaration = task.status.implementation;
  const result = { record: task.status.mainRecord || '未记录 main 集成事实。', recordedHead: task.status.mainRecord?.match(/[a-f0-9]{40}/)?.[0] ?? null, target: declaration?.target ?? null, mainHead: main.head, observedAt: main.observedAt, current: false, method: 'unknown' };
  if (!main.available || main.branch !== 'main' || !declaration?.target || declaration.errors.length) return { ...result, reason: '实现目标或范围未确认，不能仅以 owner 记录的 main HEAD 推断集成' };
  try {
    const sourceTree = await tree(task.worktree, declaration.target, declaration.scopes);
    try {
      await git(mainDirectory, 'merge-base', '--is-ancestor', declaration.target, main.head);
      return { ...result, current: true, method: 'ancestor', reason: '实现目标是现场 main HEAD 的祖先；不要求 owner 重写每次 main metadata HEAD' };
    } catch { /* Squashed/copy integrations need exact declared scope evidence. */ }
    if (task.implementationProof?.state !== 'unchanged') return { ...result, reason: '无法以祖先关系证明，且 owner 实现范围存在变化或未知' };
    const mainTree = await tree(mainDirectory, main.head, declaration.scopes);
    return { ...result, current: sourceTree === mainTree, method: sourceTree === mainTree ? 'scope-tree' : 'not-contained', reason: sourceTree === mainTree ? '目标与 main 的声明范围 Git 树相同；范围以外不作保证' : 'main 尚未包含目标，声明范围树也不同' };
  } catch (error) { return { ...result, reason: error.message.split('\n')[0] }; }
}
