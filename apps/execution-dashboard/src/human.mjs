const clean = value => value.replace(/`/g, '').trim();
function signal(value, prefix) {
  const text = clean(value);
  if (/^(?:NONE|无|无新增事项)[。.]?$/.test(text)) return { state: 'none', text: '' };
  const match = text.match(new RegExp(`^${prefix}[:：]\\s*(.+)$`));
  if (match && match[1].length <= 240 && !/^(?:NONE|UNKNOWN|无|无新增事项)[。.]?$/.test(match[1])) return { state: 'active', text: match[1] };
  return { state: 'unknown', text: '' };
}
export function parseHuman(field) {
  const phase = clean(field(/^阶段$/));
  const priorityRecord = clean(field(/^优先级$/));
  const output = clean(field(/^当前产出$/));
  const next = clean(field(/^下一可用交付$/));
  const blocker = signal(field(/^当前阻塞$/), 'ACTIVE');
  const decision = signal(field(/^需用户决定$/), 'REQUIRED');
  const missing = [];
  for (const [label, value] of [['阶段', phase], ['当前产出', output], ['下一可用交付', next]]) if (!value || value === 'UNKNOWN' || value.length > 240) missing.push(label);
  if (!/^[1-9]$/.test(priorityRecord)) missing.push('优先级');
  if (blocker.state === 'unknown') missing.push('当前阻塞');
  if (decision.state === 'unknown') missing.push('需用户决定');
  return { phase: phase === 'UNKNOWN' ? '' : phase, priority: /^[1-9]$/.test(priorityRecord) ? Number(priorityRecord) : 9, output: output === 'UNKNOWN' ? '' : output, next: next === 'UNKNOWN' ? '' : next, blocker, decision, missing, complete: missing.length === 0 };
}

export function humanOverview(tasks) {
  const completed = task => /^completed(?:$|[（(;；\s])/.test(task.status.branchState ?? '');
  const activeState = task => /^(?:in-progress|blocked)(?:$|[（(;；\s])/.test(task.status.branchState ?? '');
  const priorityOrder = (a, b) => (a.status.human?.priority ?? 9) - (b.status.human?.priority ?? 9) || a.id.localeCompare(b.id);
  const known = tasks.filter(task => task.current && task.status.human?.complete).sort(priorityOrder);
  const active = known.filter(task => /^in-progress(?:$|[（(;；\s])/.test(task.status.branchState ?? ''));
  const featured = active.slice(0, 3);
  const featuredIds = new Set(featured.map(task => task.id));
  const otherActive = tasks.filter(task => task.current && activeState(task) && !featuredIds.has(task.id)).sort(priorityOrder);
  return {
    phase: [...new Set(known.filter(task => !completed(task)).map(task => task.status.human.phase))].join(' / ') || null,
    activeIds: featured.map(task => task.id),
    otherActiveIds: otherActive.map(task => task.id),
    deliveryIds: known.filter(task => !completed(task) || !task.main.current).slice(0, 3).map(task => task.id),
    blockerIds: tasks.filter(task => task.current && task.status.human?.blocker.state === 'active').map(task => task.id),
    decisionIds: tasks.filter(task => task.current && task.status.human?.decision.state === 'active').map(task => task.id),
    unknownIds: tasks.filter(task => !completed(task) && (!task.current || !task.status.human?.complete)).map(task => task.id),
    historyIds: tasks.filter(completed).map(task => task.id),
  };
}
