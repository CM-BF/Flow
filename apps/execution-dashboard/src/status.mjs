import { parseHuman } from './human.mjs';
import { parseTaskLinks } from './task-links.mjs';
import { parseImplementation } from './proof.mjs';
const normaliseKey = value => value.replace(/\s+/g, '').toLowerCase();
const plain = value => value.replace(/`/g, '').trim();

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(value => value.trim().replace(/\\\|/g, '|'));
}

export function parseStatus(markdown, taskId) {
  const fields = {};
  const fieldRows = [];
  const errors = [];
  const todos = [];
  const sections = {};
  let section = '';
  let todoTable = false;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) { section = heading[1]; sections[section] = []; todoTable = false; continue; }
    if (line.trim().startsWith('|')) {
      const row = cells(line);
      if (row.every(cell => /^:?-+:?$/.test(cell))) continue;
      if (/TODO\s*ID/i.test(row[0])) { todoTable = true; continue; }
      if (todoTable && row.length >= 4) todos.push({ id: plain(row[0]), state: plain(row[1]), owner: plain(row[2]), evidence: row.slice(3).join(' | ') });
      else if (!section && row.length >= 2 && !['字段', 'Field'].includes(row[0])) {
        fieldRows.push([row[0], row.slice(1).join(' | ')]);
        const key = normaliseKey(row[0]);
        if (Object.hasOwn(fields, key)) errors.push(`重复字段：${row[0]}`);
        fields[key] = row.slice(1).join(' | ');
      }
    }
    if (section && line.trim()) sections[section].push(line);
  }
  const field = pattern => Object.entries(fields).find(([key]) => pattern.test(key))?.[1] ?? '';
  const owner = field(/(?:单一)?statusowner|owner\/model|负责人/);
  const branch = field(/^branch$/);
  const branchState = field(/工作分支状态/);
  const updatedRecord = field(/最近更新|更新时间/);
  const updatedMatch = updatedRecord.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\s*(?:UTC|Z)/);
  const updatedAt = updatedMatch ? new Date(updatedMatch[0].replace(' UTC', 'Z').replace(' ', 'T')).toISOString() : null;
  const findSection = pattern => Object.entries(sections).filter(([name]) => pattern.test(name)).flatMap(([, lines]) => lines);
  if (new Set(todos.map(todo => todo.id)).size !== todos.length) errors.push('重复 TODO ID');
  if (!new RegExp(`^#\\s+${taskId}\\b`, 'm').test(markdown)) errors.push('状态标题与登记任务 ID 不符');
  if (todos.some(todo => todoState(todo.state) === 'unknown')) errors.push('存在无法识别的 TODO 状态');
  if (!owner) errors.push('缺少单一 owner 字段');
  if (!branchState) errors.push('缺少工作分支状态');
  if (!updatedAt) errors.push('缺少可解析 UTC 更新时间');
  if (!todos.length) errors.push('缺少 TODO 状态表');
  if (todos.some(todo => !/^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(todo.id))) errors.push('TODO ID 格式未知');
  return {
    taskLinks: parseTaskLinks(taskId, fieldRows),
    human: parseHuman(field), implementation: parseImplementation(plain(field(/^实现目标$/)), field(/^实现范围$/)),
    taskId, owner: plain(owner), branch: plain(branch), branchState: plain(branchState),
    updatedAt, updatedRecord: plain(updatedRecord), todos, errors,
    declaredHead: field(/工作基线|head/), declaredDirty: field(/工作树dirty状态/),
    checks: parseChecks(field(/检查状态|checks/)),
    reviewRecord: field(/^review$/), mainRecord: field(/已集成main状态/),
    next: findSection(/下一步|handoff/).join('\n'),
    risks: findSection(/阻塞|风险|未验证/).join('\n'),
    decisions: findSection(/用户决定|用户决策|需.*决定/).join('\n'),
  };
}

function parseChecks(record) {
  const token = record.replace(/`/g, '').trim();
  const target = token.match(/\b[a-f0-9]{40}\b/)?.[0] ?? null;
  let state = 'unknown';
  if (/^PASSED\b/.test(token) && target) state = 'passed';
  if (/^FAILED\b/.test(token) && target) state = 'failed';
  if (/^NOT_RUN\b/.test(token)) state = 'not_run';
  return { state, target, record: record || '未提供独立检查状态字段；请打开证据核对具体提交。' };
}

export function reviewState(markdown, statusRecord = '') {
  if (!markdown?.trim()) return { state: 'not_started', record: '空 review 不构成通过。', target: null };
  const record = markdown.match(/(?:\*\*)?状态[：:]\s*([^\n]+)/)?.[1] ?? statusRecord;
  const target = markdown.match(/Review target commit[^\n]*?\b([a-f0-9]{40})\b/i)?.[1] ?? null;
  if (/NOT_STARTED|未审查|模板待review/.test(record)) return { state: 'not_started', record, target };
  if (/CHANGES_REQUESTED|BLOCKED/.test(record)) return { state: 'changes_requested', record, target };
  if (/^APPROVED\b/.test(record.replace(/[`*]/g, '').trim()) && target) return { state: 'approved', record, target };
  return { state: 'unknown', record: record || '未识别独立审查结论。', target };
}

export function todoState(value) {
  if (/^completed(?:$|[（(\s])/.test(value)) return 'completed';
  if (/^in-progress(?:$|[（(\s])/.test(value)) return 'in_progress';
  if (/^blocked(?:$|[（(\s])/.test(value)) return 'blocked';
  if (/^pending(?:$|[（(\s])/.test(value)) return 'pending';
  return 'unknown';
}
