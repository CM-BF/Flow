import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const textExtensions = new Set(['.md', '.json', '.txt', '.log', '.patch']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
export const documentLimit = 2 * 1024 * 1024;

export function permittedPath(task, relative) {
  if (!relative || relative.includes('\\') || path.isAbsolute(relative) || path.posix.normalize(relative) !== relative || relative.startsWith('../')) return false;
  const inPlan = relative.startsWith(`${task.planDir}/`);
  const inEvidence = relative.startsWith(`${task.evidenceDir}/`);
  const appEvidence = relative === task.appEvidence;
  return (inPlan || inEvidence || appEvidence) && (textExtensions.has(path.extname(relative)) || imageExtensions.has(path.extname(relative)));
}

export async function readWithinWorktree(task, relative) {
  if (!permittedPath(task, relative)) throw new Error('资料路径不在登记任务范围');
  const root = await realpath(task.worktree);
  const filename = await realpath(path.join(root, relative));
  if (!filename.startsWith(`${root}${path.sep}`)) throw new Error('资料链接越出 worktree');
  if (!permittedPath(task, path.relative(root, filename).split(path.sep).join('/'))) throw new Error('资料真实路径越出登记任务范围');
  const info = await stat(filename);
  if (!info.isFile() || info.size > documentLimit) throw new Error('资料不是文件或超过 2 MiB；请在本地查看');
  return { content: await readFile(filename), modifiedAt: info.mtime.toISOString() };
}

export async function listDocuments(task) {
  const docs = ['plan.md', 'status.md', 'review.md'].map(name => ({ path: `${task.planDir}/${name}`, title: name, kind: 'plan' }));
  const discovered = new Map(docs.map(doc => [doc.path, doc]));
  for (const doc of docs) {
    try {
      const { content } = await readWithinWorktree(task, doc.path);
      for (const match of content.toString('utf8').matchAll(/!?\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
        let target;
        try { target = decodeURIComponent(match[2].split('#')[0]); } catch { continue; }
        if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
        const relative = path.posix.normalize(path.posix.join(path.posix.dirname(doc.path), target));
        if (permittedPath(task, relative) && !discovered.has(relative)) discovered.set(relative, { path: relative, title: match[1], kind: 'evidence' });
      }
    } catch { /* The aggregator reports unavailable status; document entries remain visible. */ }
  }
  return [...discovered.values()];
}

export async function readDocument(task, relative) {
  const documents = await listDocuments(task);
  if (!documents.some(doc => doc.path === relative)) throw new Error('资料未被该任务计划、状态或 review 引用');
  return readWithinWorktree(task, relative);
}
