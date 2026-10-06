import path from 'node:path';

const RECORD_LIMIT = 2048;
const keyOf = value => value.replace(/\s+/g, '').toLowerCase();
const unknown = (record, reason) => ({ state: 'unknown', record, reason });
function field(rows, key) {
  const values = rows.filter(([name]) => keyOf(name) === key).map(([, value]) => value.trim());
  const joined = values.join('；');
  const record = joined.length > RECORD_LIMIT ? `${joined.slice(0, RECORD_LIMIT)}…（完整记录见 status）` : joined;
  if (!values.length) return unknown('', '未声明');
  if (values.length !== 1) return unknown(record, '字段重复，不能选择其中一项');
  if (!values[0] || values[0].length > RECORD_LIMIT || /[\x00-\x1f]/.test(values[0])) return unknown(record, '字段为空、超长或包含控制字符');
  return { state: 'known', record, value: values[0] };
}
function link(value) {
  if (value.state !== 'known') return value;
  const match = value.value.match(/^\[([A-Z0-9]+(?:-[A-Z0-9]+)*)\]\((<[^<>]+>|[^\s()]+)\)$/);
  if (!match) return unknown(value.record, '须声明唯一稳定 ID 及计划链接');
  let location;
  try { location = decodeURIComponent(match[2].replace(/^<|>$/g, '').split('#')[0]); }
  catch { return unknown(value.record, '计划链接编码非法'); }
  if (!location || /^[a-z][a-z0-9+.-]*:/i.test(location) || location.startsWith('//') || /[\\\x00-\x1f?]/.test(location)) return unknown(value.record, '计划链接不是本地计划声明');
  return { state: 'known', record: value.record, id: match[1], location };
}

/** Pure declarations only. No filesystem reads, URL navigation or inferred ownership. */
export function parseTaskLinks(taskId, rows) {
  const parent = link(field(rows, '所属大task'));
  const leadField = field(rows, 'co-lead');
  const coLead = leadField.state === 'known' && leadField.value.length > 160 ? unknown(leadField.record, 'co-lead 超过160字') : leadField;
  const level = field(rows, '任务层级');
  const ownId = link(field(rows, '大taskid'));
  let kind = 'unknown', reason = '旧记录未声明层级';
  if (level.state === 'known' && level.value === '大task' && parent.reason === '未声明') {
    if (ownId.reason === '未声明' || (ownId.state === 'known' && ownId.id === taskId)) { kind = 'big'; reason = ''; }
    else reason = '大task ID 与自身声明冲突';
  } else if (parent.state === 'known' && ownId.reason === '未声明' && (level.reason === '未声明' || (level.state === 'known' && level.value === '子task'))) {
    kind = 'subtask'; reason = '';
  } else if (level.reason !== '未声明' || parent.reason !== '未声明') reason = '层级或父任务声明冲突/不完整';
  return { kind, reason, parent, coLead, ownId };
}
function canonicalPlan(task) { return path.posix.join(task.worktree, task.planDir, 'plan.md'); }
function matchesPlan(declaration, source, target) {
  const declared = path.posix.resolve(source.worktree, source.planDir, declaration.location);
  return declared === canonicalPlan(target);
}
function sourceProblem(task) {
  if (task.source?.mode === 'missing') return 'status 来源缺失';
  if (task.source?.mode === 'frozen') return '仅有冻结旧 status';
  if (task.source?.stale) return 'status 陈旧或时钟待核实';
  if (!task.current) return 'status 来源或字段待核实';
  return '';
}
function ownDeclaration(task) {
  const declared = task.status.taskLinks;
  if (!declared) return { kind: 'unknown', reason: '关系字段未解析', parent: unknown('', '未声明'), coLead: unknown('', '未声明') };
  if (declared.kind === 'big' && declared.ownId.state === 'known' && !matchesPlan(declared.ownId, task, task)) return { ...declared, kind: 'unknown', reason: '大task ID 链接与登记计划不符' };
  return declared;
}
function resolveOne(task, registered) {
  const declared = ownDeclaration(task), problem = sourceProblem(task);
  const coLead = problem ? unknown(declared.coLead.record, problem) : declared.coLead;
  const result = { kind: problem ? 'unknown' : declared.kind, coLead, parent: unknown(declared.parent.record, problem || declared.reason || declared.parent.reason) };
  if (declared.kind === 'big') {
    if (!problem) result.parent = { state: 'none', record: '', reason: '已显式声明为大task，无所属父任务' };
    return result;
  }
  if (declared.parent.state !== 'known') return result;
  const parent = registered.get(declared.parent.id);
  if (parent === task) { result.parent.reason = '不允许自引用父任务'; return result; }
  if (!parent) { result.parent.reason = '父任务未登记，关系待核实'; return result; }
  if (!matchesPlan(declared.parent, task, parent)) { result.parent.reason = '父 ID 与登记计划链接不一致'; return result; }
  // Only a registered ID with its matching canonical declaration may become a UI action.
  result.parent.targetId = parent.id;
  result.parent.title = parent.title;
  if (problem) return result;
  if (declared.kind !== 'subtask') return result;
  const parentDeclaration = ownDeclaration(parent);
  if (parentDeclaration.parent.state === 'known') {
    result.parent.reason = parentDeclaration.parent.id === task.id ? '父任务声明形成循环' : '父任务又声明父任务，超过两层';
    return result;
  }
  const parentProblem = sourceProblem(parent);
  if (parentProblem) { result.parent.reason = `父任务${parentProblem}`; return result; }
  if (parentDeclaration.kind !== 'big') { result.parent.reason = '父任务层级未明确或声明冲突'; return result; }
  result.parent.state = 'known'; result.parent.reason = '';
  return result;
}

/** One bounded parent lookup per registered task; never aggregate children into parent progress. */
export function resolveTaskLinks(tasks) {
  const registered = new Map(tasks.map(task => [task.id, task]));
  return new Map(tasks.map(task => [task.id, resolveOne(task, registered)]));
}
