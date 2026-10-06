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

async function collectTreeRecords(directory, target, scopes, records) {
  let output;
  try {
    output = await git(directory, 'ls-tree', '-r', '-z', '--full-tree', target, '--', ...scopes.map(scope => `:(literal)${scope}`));
  } catch (error) {
    // Discard partial stdout. Preserve the existing per-scope buffer limit, with serial fallback only for size limits.
    if (!['ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'E2BIG'].includes(error.code) || scopes.length < 2) throw error;
    const middle = Math.floor(scopes.length / 2);
    await collectTreeRecords(directory, target, scopes.slice(0, middle), records);
    await collectTreeRecords(directory, target, scopes.slice(middle), records);
    return;
  }
  for (const record of pathsFrom(output)) records.add(record);
}

async function tree(directory, target, scopes, requireEveryPath = true) {
  if ((await git(directory, 'cat-file', '-t', target)).trim() !== 'commit') throw new Error('目标不是 commit');
  const records = new Set();
  await collectTreeRecords(directory, target, scopes, records);
  if (requireEveryPath) {
    const files = [...records].map(record => record.slice(record.indexOf('\t') + 1));
    for (const scope of scopes) {
      if (!files.some(file => file === scope || file.startsWith(`${scope}/`))) throw new Error(`目标中不存在实现路径：${scope}`);
    }
  }
  return [...records].sort().join('\0');
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
  const result = {
    record: task.status.mainRecord || '未记录 main 集成事实。',
    recordedHead: task.status.mainRecord?.match(/[a-f0-9]{40}/)?.[0] ?? null,
    target: declaration?.target ?? null, mainHead: main.head, scopes: declaration?.scopes ?? [],
    observedAt: main.observedAt, current: false, historicalIntegrated: false, method: 'unknown',
  };
  if (!main.available || main.branch !== 'main' || !declaration?.target || declaration.errors.length) {
    return { ...result, reason: '实现目标或范围未确认，不能仅以 owner 记录的 main HEAD 推断集成' };
  }
  try {
    const sourceTree = await tree(task.worktree, declaration.target, declaration.scopes);
    try {
      await git(mainDirectory, 'merge-base', '--is-ancestor', declaration.target, main.head);
      result.historicalIntegrated = true;
    } catch { /* Non-ancestor integrations still require exact scope evidence. */ }
    if (!result.historicalIntegrated && task.implementationProof?.state !== 'unchanged') {
      return { ...result, reason: '无法以祖先关系证明，且 owner 实现范围存在变化或未知' };
    }
    const [mainTree, dirty, untracked] = await Promise.all([
      tree(mainDirectory, main.head, declaration.scopes, false),
      git(mainDirectory, 'diff', '--name-only', '-z', '--no-renames', 'HEAD', '--'),
      git(mainDirectory, 'ls-files', '--others', '--exclude-standard', '-z'),
    ]);
    const dirtyScopePaths = [...new Set([...pathsFrom(dirty), ...pathsFrom(untracked)])].filter(file => covers(declaration.scopes, file));
    const scopeEqual = sourceTree === mainTree;
    if (!scopeEqual || dirtyScopePaths.length) {
      return { ...result, scopeEqual, dirtyScopePaths, method: result.historicalIntegrated ? 'ancestor-changed' : 'not-contained', reason: result.historicalIntegrated ? '历史已合入；当前声明范围已有变化或未提交内容，需核验后继实现，不判断新实现失效' : 'main 声明范围与目标不同，或存在未提交变化' };
    }
    return { ...result, current: true, scopeEqual, dirtyScopePaths, method: result.historicalIntegrated ? 'ancestor' : 'scope-tree', reason: result.historicalIntegrated ? '目标已合入，现场声明范围树仍相同；无关 main metadata 更新不影响此结论' : '目标与 main 的声明范围 Git 树相同；范围以外不作保证' };
  } catch (error) { return { ...result, reason: error.message.split('\n')[0] }; }
}
