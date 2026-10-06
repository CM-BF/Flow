const clean = value => value.replace(/`/g, '').trim();
const deliveryStages = new Set(['planning', 'implementation', 'review', 'integration', 'delivered']);
function deliveryState(task) {
  const declared = task.status.human?.delivery;
  if (declared?.source === 'explicit') return declared.state;
  const branch = task.status.branchState ?? '';
  if (/^(?:in-progress|blocked)(?:$|[（(;；\s])/.test(branch)) return 'implementation';
  // Legacy completion is author progress only; it does not infer review or integration.
  if (/^(?:completed|delivered)(?:$|[（(;；\s])/.test(branch)) return 'legacy-complete';
  return 'unknown';
}
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
  const deliveryRecord = clean(field(/^本片段交付阶段$/));
  const delivery = deliveryRecord ? { state: deliveryStages.has(deliveryRecord) ? deliveryRecord : 'unknown', source: 'explicit' } : { state: 'unknown', source: 'legacy' };
  const blocker = signal(field(/^当前阻塞$/), 'ACTIVE');
  const decision = signal(field(/^需用户决定$/), 'REQUIRED');
  const missing = [];
  for (const [label, value] of [['阶段', phase], ['当前产出', output], ['下一可用交付', next]]) if (!value || value === 'UNKNOWN' || value.length > (label === '阶段' ? 24 : 240)) missing.push(label);
  if (deliveryRecord && delivery.state === 'unknown') missing.push('本片段交付阶段');
  if (!/^[1-9]$/.test(priorityRecord)) missing.push('优先级');
  if (blocker.state === 'unknown') missing.push('当前阻塞');
  if (decision.state === 'unknown') missing.push('需用户决定');
  return { delivery, phase: phase === 'UNKNOWN' || phase.length > 24 ? '' : phase, priority: /^[1-9]$/.test(priorityRecord) ? Number(priorityRecord) : 9, output: output === 'UNKNOWN' ? '' : output, next: next === 'UNKNOWN' ? '' : next, blocker, decision, missing, complete: missing.length === 0 };
}

export function humanOverview(tasks, phaseSourceId = 'FLOW-001') {
  const completed = task => ['delivered', 'legacy-complete'].includes(deliveryState(task));
  const activeState = task => ['implementation', 'review', 'integration'].includes(deliveryState(task));
  const priorityOrder = (a, b) => (a.status.human?.priority ?? 9) - (b.status.human?.priority ?? 9) || a.id.localeCompare(b.id);
  const known = tasks.filter(task => task.current && task.status.human?.complete).sort(priorityOrder);
  const active = known.filter(activeState);
  const activeIds = new Set(active.map(task => task.id));
  // Only verified direct relationships may share headline space. Parent facts stay its own.
  const headlines = active.filter(task => !(task.links?.kind === 'subtask'
    && task.links.parent.state === 'known' && activeIds.has(task.links.parent.targetId)));
  const featured = headlines.slice(0, 3);
  const featuredIds = new Set(featured.map(task => task.id));
  const otherActive = tasks.filter(task => task.current && activeState(task) && !featuredIds.has(task.id)).sort(priorityOrder);
  return {
    phase: tasks.find(task => task.id === phaseSourceId && task.current)?.status.human?.phase || null,
    phaseSourceId,
    activeIds: featured.map(task => task.id),
    otherActiveIds: otherActive.map(task => task.id),
    deliveryIds: [...headlines].sort((a, b) => Number(b.status.human.blocker.state === 'active') - Number(a.status.human.blocker.state === 'active') || priorityOrder(a, b)).slice(0, 3).map(task => task.id),
    blockerIds: tasks.filter(task => task.current && task.status.human?.blocker.state === 'active').map(task => task.id),
    decisionIds: tasks.filter(task => task.current && task.status.human?.decision.state === 'active').map(task => task.id),
    unknownIds: tasks.filter(task => !completed(task) && (!task.current || !task.status.human?.complete)).map(task => task.id),
    historyIds: tasks.filter(completed).map(task => task.id),
  };
}
