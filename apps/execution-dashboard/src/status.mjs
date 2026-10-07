import { parseHuman } from './human.mjs';
import { parseTaskLinks } from './task-links.mjs';
import { parseImplementation } from './proof.mjs';
const normaliseKey = value => value.replace(/\s+/g, '').toLowerCase();
const plain = value => value.replace(/`/g, '').trim();

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(value => value.trim().replace(/\\\|/g, '|'));
}

function parseUtcUpdate(record) {
  // A combined field can include a separate main-sync observation. It must
  // never supply the update, even when the primary record has no date at all.
  const primary = plain(record).split(/\bmain\s*(?:同步|sync\b)/i, 1)[0];
  // A standalone year prefix also catches malformed/slash dates, without
  // treating embedded task identifiers such as WPF-DPERF05-01 as dates.
  const start = primary.search(/(?<![A-Za-z0-9_-])[+-]?\d{3,}[-/]/);
  if (start < 0) return null;
  const match = primary.slice(start).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(?:UTC|Z|\+00:00)(?![\w.+:/-])/);
  if (!match) return null;
  return utcParts(match);
}

function utcParts(match) {
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', fraction = ''] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 24 || minute > 59 || second > 59) return null;
  if (hour === 24 && (minute !== 0 || second !== 0 || /[1-9]/.test(fraction))) return null;

  // setUTCFullYear preserves years 0000–0099; Date.UTC remaps them to 1900–1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const milliseconds = Number(fraction.slice(0, 3).padEnd(3, '0'));
  date.setUTCHours(hour, minute, second, milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function declaredInstant(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/);
  return match && Number(match[4]) < 24 ? utcParts(match) : null;
}

function parseWaitingTable(raw) {
  const rows = [], issues = [], ids = new Set();
  const lines = raw.split(/\r?\n/).filter(line => line.trim().startsWith('|'));
  if (!lines.length) return { rows, issues: raw.trim() ? ['等待记录不是约定表格；保留原文'] : [] };
  const header = ['ID', '开始UTC', '结束UTC', '类别', '原因与解除条件', '来源'];
  if (JSON.stringify(cells(lines[0])) !== JSON.stringify(header)) return { rows, issues: ['等待表列名不符；保留原文'] };
  const instant = (record, end, rowIssues) => {
    const token = plain(record);
    if (end && token === 'OPEN') return { state: 'open', at: null, record };
    const at = declaredInstant(token);
    if (!at && token !== 'UNKNOWN') rowIssues.push('时间须为 ISO UTC、UNKNOWN 或结束列的 OPEN');
    return { state: at ? 'known' : 'unknown', at, record };
  };
  for (const [index, line] of lines.entries()) {
    if (!index) continue;
    const values = cells(line);
    if (values.every(value => /^:?-+:?$/.test(value))) continue;
    if (values.length !== 6) { issues.push(`第${index + 1}行列数不符；保留原文`); continue; }
    const [id, start, end, category, reason, source] = values;
    const rowIssues = [];
    if (!id || ids.has(id)) rowIssues.push('等待 ID 缺失或重复');
    ids.add(id);
    if (!['资源', '接口', '验证失败', '审查', '用户', '其他'].includes(category)) rowIssues.push('类别未知');
    if (!reason || !source || source === 'UNKNOWN') rowIssues.push('原因或来源未明确');
    const started = instant(start, false, rowIssues), ended = instant(end, true, rowIssues);
    if (started.at && ended.at && ended.at < started.at) rowIssues.push('等待结束早于开始');
    rows.push({ id, started, ended, category, reason, source, issues: rowIssues });
    issues.push(...rowIssues.map(issue => `${id || `第${index + 1}行`}：${issue}`));
  }
  // A later duplicate invalidates both rows, rather than silently choosing one.
  const counts = new Map();
  for (const row of rows) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  for (const row of rows) if (counts.get(row.id) > 1 && !row.issues.includes('等待 ID 缺失或重复')) row.issues.push('等待 ID 缺失或重复');
  return { rows, issues };
}

const timingKeys = new Set(['任务开工时间', '任务完成时间', '任务时间来源']);

function parseTaskTiming(fieldRows, waiting) {
  const issues = [];
  function record(key) {
    const matches = fieldRows.filter(([name]) => normaliseKey(name) === key);
    if (matches.length > 1) issues.push(`${key}重复，无法确定唯一声明`);
    return { value: matches.map(([, value]) => plain(value)).join('\n'), unique: matches.length === 1 };
  }
  function instant(key, allowIncomplete = false) {
    const { value, unique } = record(key);
    if (unique && allowIncomplete && value === 'NOT_COMPLETED') return { state: 'not_completed', at: null, record: value };
    // The new task contract is an entire ISO UTC field, not an update sentence.
    const at = unique ? declaredInstant(value) : null;
    if (!at) issues.push(`${key}${!value || value === 'UNKNOWN' ? '未记录' : '不是唯一有效的 ISO UTC 时间'}`);
    return { state: at ? 'known' : 'unknown', at: at || null, record: value };
  }
  const started = instant('任务开工时间');
  const completed = instant('任务完成时间', true);
  const provenance = record('任务时间来源');
  const sourceKnown = provenance.unique && Boolean(provenance.value) && provenance.value !== 'UNKNOWN';
  if (!sourceKnown) issues.push('任务时间来源未知');
  if (started.at && completed.at && completed.at < started.at) issues.push('任务完成时间早于开工时间');
  return { started, completed, source: { state: sourceKnown ? 'declared' : 'unknown', record: provenance.value }, issues, waiting, waitingTable: parseWaitingTable(waiting) };
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
        if (Object.hasOwn(fields, key) && !timingKeys.has(key)) errors.push(`重复字段：${row[0]}`);
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
  const updatedAt = parseUtcUpdate(updatedRecord);
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
    timing: parseTaskTiming(fieldRows, (sections['等待记录'] ?? []).join('\n')),
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
