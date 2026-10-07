const themes = new Set(['light', 'dark']);
const media = window.matchMedia('(prefers-color-scheme: dark)');
const themeSelect = document.querySelector('#theme');
let preference = 'system';
try { preference = localStorage.getItem('flow-dashboard-theme') ?? 'system'; } catch { /* Private modes may disable storage. */ }
if (!themes.has(preference) && preference !== 'system') preference = 'system';
themeSelect.value = preference;
function applyTheme() { document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference; }
applyTheme();
media.addEventListener('change', applyTheme);
themeSelect.addEventListener('change', () => { preference = themeSelect.value; applyTheme(); try { localStorage.setItem('flow-dashboard-theme', preference); } catch { /* Theme still works for this visit. */ } });

const $ = selector => document.querySelector(selector);
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function badge(text, tone = '') { return element('span', text, `badge ${tone}`); }
function taskButton(task, text = '查看详情') { const button = element('button', text === '查看详情' ? '详情' : text); button.type = 'button'; button.dataset.openTask = task.id; button.setAttribute('aria-label', `${text}：${task.id} ${task.title}`); return button; }
function plain(value = '') { return value.replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '').replace(/^[-#]+\s*/gm, '').trim(); }
function timestamp(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未记录'; }
function reviewBadge(task) { if (!task.current) return badge('待同步', 'warning'); const states = { approved: ['已审范围未变', 'good'], not_started: ['待审查', ''], changes_requested: ['需修复', 'bad'], outdated: ['待复审', 'warning'], unknown: ['未知', 'warning'] }; return badge(...(states[task.review.state] ?? states.unknown)); }
function mainBadge(task) {
  if (!task.current) return badge('来源待核实');
  if (task.main.current) return badge(task.main.method === 'ancestor' ? '已合入，范围未变' : '范围与 main 相同', 'good');
  return badge(task.main.historicalIntegrated ? '曾合入，当前待核验' : '集成待核实');
}
let snapshot, assignmentObservation, assignmentFailure, summaryFailure, assignmentLoading = false;
let selectedTask, returnFocus;
let detailSource;
let snapshotCurrent = false;
// Per-surface observation identity preserves an open detail across later summaries.
const timingObservations = new WeakMap();
let documentRequest, detailRequest, assignmentRequest, summaryFlight;
let summaryEpoch = 0, assignmentEpoch = 0, selectionEpoch = 0, documentEpoch = 0, detailEpoch = 0;

function applyAssignments() {
  if (!snapshot) return;
  const observation = assignmentObservation?.registryFingerprint === snapshot.registryFingerprint ? assignmentObservation : null;
  snapshot.assignments = observation?.assignments ?? { state: 'unknown', observedAt: null, reason: '领取观察尚未完成' };
  snapshot.unregisteredAssignments = observation?.unregisteredAssignments ?? [];
  for (const task of snapshot.tasks) task.assignments = observation?.byTask[task.id] ?? null;
}
function assignmentFacts(claim, registered = true) {
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [
    ['领取 ID / version', `${claim.claimId} / ${claim.version}`], ['Lead / Worker', `${claim.lead} / ${claim.worker}`],
    ['状态 / role', `${claim.state} / ${claim.role}`], ['Branch / worktree', `${claim.branch}\n${claim.worktree}`],
    ['精确 scope', claim.scope.join('\n') || '无实现写权限'],
    ['进度来源匹配', registered ? (claim.matchesSource ? '登记 branch/worktree 相符' : '不符，待对齐') : '不适用：进度来源尚未登记'],
    ['来源', claim.origin === 'migration' ? `现有合法派工迁移；观察 ${timestamp(claim.observedAt)}` : '原子领取'],
    ['更新 / 核对', `${timestamp(claim.updatedAt)}${claim.needsVerification ? '；记录陈旧但仍占用，禁止抢占' : ''}`],
    ['账本观察时间', timestamp(snapshot?.assignments.observedAt)],
    ['接收方', claim.next ? `${claim.next.lead} / ${claim.next.worker}\n${claim.next.worktree}\n${claim.next.branch ?? ''}` : '无'],
  ]) facts.append(element('dt', label), element('dd', value));
  return facts;
}
function allocationText(task, summary = true) {
  if (task.assignments === null) return '领取状态未知';
  if (!task.assignments?.length) return '尚无领取登记；接手前须核对';
  return [...new Set(task.assignments.map(claim => `${claim.role === 'review' ? '只读审查' : claim.role === 'integration' ? '受控集成' : claim.state === 'handoff_pending' ? '交接待接收' : '已领取'}${summary ? '' : ` · ${claim.lead} / ${claim.worker}`}${claim.needsVerification ? ' · 待核对（仍占用）' : ''}${claim.matchesSource ? '' : ' · 进度来源待对齐'}`))].join('；');
}
function updateClaimReading(row, claim) {
  // A fingerprint of displayed facts only; all current authority stays in snapshot.
  row.dataset.record = JSON.stringify(claim);
  row.querySelector('h3').textContent = claim.taskId;
  row.querySelector('summary').textContent = `查看领取详情：${claim.taskId}`;
  row.querySelector('[data-claim-state]').textContent = `${claim.state}${claim.needsVerification ? ' · 待核对（仍占用）' : ''}`;
  row.querySelector('.detail-facts').replaceWith(assignmentFacts(claim, false));
}
function createClaimReading(claim) {
  const row = element('article', undefined, 'task-row'), copy = element('div', undefined, 'task-copy');
  row.dataset.claimId = claim.claimId;
  const state = element('p'); state.dataset.claimState = '';
  const notice = element('p', undefined, 'notice warning'); notice.dataset.claimObservation = '';
  const details = element('details'), summary = element('summary', `查看领取详情：${claim.taskId}`);
  details.append(summary, element('dl', undefined, 'detail-facts'));
  const refresh = element('button', '更新此详情'); refresh.type = 'button'; refresh.dataset.claimRefresh = '';
  refresh.addEventListener('click', () => {
    const current = snapshot.unregisteredAssignments.find(item => item.claimId === claim.claimId);
    if (!assignmentLoading && snapshot.assignments.state === 'available' && current) {
      updateClaimReading(row, current); summary.focus(); renderUnregisteredClaims();
    } else void refreshAssignments();
  });
  // Closing an absent old record dismisses this reading surface, never a claim.
  details.addEventListener('toggle', renderUnregisteredClaims);
  copy.append(element('h3', claim.taskId), state, notice, details, refresh); row.append(copy);
  updateClaimReading(row, claim); return row;
}
function renderUnregisteredClaims() {
  const container = $('#unregistered-claim-items');
  const claims = new Map(snapshot.unregisteredAssignments.map(claim => [claim.claimId, claim]));
  const rows = new Map([...container.children].map(row => [row.dataset.claimId, row]));
  for (const [id, claim] of claims) if (!rows.has(id)) container.append(createClaimReading(claim));
  for (const row of [...container.children]) {
    const claim = claims.get(row.dataset.claimId), details = row.querySelector('details');
    const reading = details.open || row.contains(document.activeElement);
    const available = !assignmentLoading && snapshot.assignments.state === 'available';
    if (available && !claim && !reading) { row.remove(); continue; }
    let unchanged = claim && row.dataset.record === JSON.stringify(claim);
    if (available && claim && !unchanged && !reading) { updateClaimReading(row, claim); unchanged = true; }
    row.dataset.freshness = available && unchanged ? 'current-observation' : 'prior-observation';
    row.querySelector('[data-claim-observation]').textContent = !available
      ? '领取观察正在刷新或未知；以下保留上次记录，禁止据此新接手。'
      : !claim ? '本次观察中已不在未登记领取列表；以下仅为旧记录，不代表仍占用或已释放。收起并离开详情后移除此旧观察。'
        : unchanged ? `字段未变化；最近领取观察 ${timestamp(snapshot.assignments.observedAt)}。详情保留原读取时间，接手仍须原子核对。`
          : '领取版本或内容已变化；以下保留正在阅读的旧记录，请更新此详情，禁止据此新接手。';
    row.querySelector('[data-claim-refresh]').textContent = available && claim ? '更新此详情' : '重新核对领取';
  }
  $('#unregistered-claims').hidden = container.children.length === 0;
}
function renderAssignments() {
  if (!snapshot) return;
  renderUnregisteredClaims();
  for (const node of document.querySelectorAll('[data-allocation]')) {
    const task = snapshot.tasks.find(task => task.id === node.dataset.allocation);
    if (task) node.textContent = allocationText(task, node.dataset.compact !== 'false');
  }
  const note = snapshot.assignments.state === 'available'
    ? `${assignmentLoading ? '上次领取观察（正在刷新）' : '领取观察'} ${timestamp(snapshot.assignments.observedAt)}；领取和接手须经原子协调入口。`
    : `领取状态未知：${snapshot.assignments.reason || snapshot.assignments.error || snapshot.assignments.message || '待观察'}；禁止据此新接手。`;
  $('#assignment-observation').textContent = `${note}${assignmentFailure ? ` 本次失败 ${timestamp(assignmentFailure.at)}：${assignmentFailure.message}` : ''}`;
  $('#assignment-observation').dataset.readId = assignmentObservation?.readId ?? 'unknown';
  if (selectedTask) renderSelectedAssignments();
}

// One formatter per page, with an offset for each instant (including DST folds).
const localClock = (() => {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' });
    return { formatter, zone: formatter.resolvedOptions().timeZone };
  } catch { return { formatter: null, zone: 'UTC' }; }
})();
function taskTime(value) {
  if (value?.state !== 'known') return value?.state === 'not_completed' ? '尚未完成（负责人声明）' : '未知';
  if (!Number.isFinite(Date.parse(value.at))) return '未知';
  try {
    if (localClock.formatter) return localClock.formatter.format(new Date(value.at));
  } catch { /* Preserve the UTC basis when local formatting is unavailable. */ }
  return `${value.at} UTC`;
}
function timeLine(timing) {
  const line = element('p', undefined, 'task-time-line');
  for (const [index, [label, value]] of [['开工', timing?.started], ['完成', timing?.completed]].entries()) {
    line.append(element('span', `${index ? ' · ' : ''}${label}：`));
    const node = element(value?.state === 'known' ? 'time' : 'span', taskTime(value));
    if (value?.state === 'known') node.dateTime = value.at;
    line.append(node);
  }
  return line;
}
function waitingState(row, observation, current) {
  const observed = Date.parse(observation.generatedAt);
  if (row.issues.length || !Number.isFinite(observed)
    || [row.started.at, row.ended.at].some(at => at && Date.parse(at) > observed)) return '时间或来源待核实';
  if (row.ended.state === 'known') return '已结束（负责人记录）';
  if (row.ended.state !== 'open') return '结束时间未知；不推断仍在等待';
  return current ? '仍在等待（截至本次同步）' : '当时记录未结束；当前是否等待未知';
}
function waitingView(timing, observation, current) {
  const table = element('table', undefined, 'timing-waits');
  table.append(element('caption', '负责人等待记录，不合计时长'));
  const head = element('thead'), header = element('tr');
  for (const text of ['等待原因', '时间记录']) { const cell = element('th', text); cell.scope = 'col'; header.append(cell); }
  head.append(header); table.append(head);
  const body = element('tbody');
  for (const [index, row] of (timing?.waitingTable?.rows ?? []).entries()) {
    const tr = element('tr'), reason = element('td'), times = element('td');
    reason.append(element('strong', row.category || '类别未知'), element('p', row.reason || '原因未知'));
    const state = element('p', waitingState(row, observation, current), 'waiting-state'); state.dataset.waitingIndex = String(index);
    times.append(state, element('p', `开始：${taskTime(row.started)}`), element('p', `结束：${row.ended.state === 'open' ? '未结束声明' : taskTime(row.ended)}`));
    tr.append(reason, times); body.append(tr);
  }
  table.append(body);
  return body.children.length ? table : element('p', '等待记录未结构化；完整原文见时间依据。', 'muted');
}
function elapsedText(task, observedSnapshot, current) {
  if (!task) return '历时未知（任务已不在本次快照中）';
  const timing = task.status.timing;
  if (!current || task.source.mode !== 'live' || task.source.stale) return '历时未知（来源待同步；保留时间声明）';
  if (!timing || timing.issues.length || timing.source.state !== 'declared') return '历时未知（时间或来源待核实）';
  const snapshotTime = observedSnapshot.generatedAt;
  const observed = Date.parse(snapshotTime);
  const start = Date.parse(timing.started.at);
  const end = timing.completed.state === 'not_completed' ? observed : Date.parse(timing.completed.at);
  if (![observed, start, end].every(Number.isFinite) || new Date(observed).toISOString() !== snapshotTime || start > observed || end > observed || end < start) return '历时未知（未来时间或区间逆序）';
  const seconds = Math.floor((end - start) / 1000);
  const duration = [[Math.floor(seconds / 86400), '天'], [Math.floor(seconds / 3600) % 24, '小时'], [Math.floor(seconds / 60) % 60, '分'], [seconds % 60, '秒']].filter(([amount]) => amount).map(([amount, unit]) => `${amount}${unit}`).join(' ') || '0秒';
  const label = timing.completed.state === 'not_completed' ? '已历时（含等待，截至本次同步）' : '已历时（含等待，负责人声明完成）';
  return `${label}：${duration}`;
}
function summaryTiming(task) {
  const section = element('div', undefined, 'task-timing');
  section.dataset.timingTask = task.id;
  section.append(timeLine(task.status.timing), element('p', `本地时间 ${localClock.zone} · 每项含 UTC 偏移`, 'timing-zone'));
  timingObservations.set(section, { task, observation: snapshot, epoch: summaryEpoch, current: task.sourceCurrent });
  section.append(element('p', elapsedText(task, snapshot, snapshotCurrent && task.sourceCurrent), 'task-elapsed'));
  return section;
}
function timingDetails(task, observation, matched) {
  const section = element('section'); section.id = 'task-timing-detail'; section.setAttribute('aria-label', '任务时间');
  section.append(element('h3', '任务时间'), element('p', '唯一负责人声明；含等待的壁钟历时，不代表实际工作或 CPU 用时。', 'muted'));
  const facts = element('dl', undefined, 'detail-facts');
  const timing = task.status.timing;
  for (const [label, value] of [
    ['任务开工时间（UTC）', timing?.started.at || timing?.started.record || 'UNKNOWN'], ['任务完成时间（UTC）', timing?.completed.at || timing?.completed.record || 'UNKNOWN'],
    ['时间来源（负责人声明，未独立核验）', timing?.source.record], ['时间声明原文', `${timing?.started.record || 'UNKNOWN'}\n${timing?.completed.record || 'UNKNOWN'}`],
    ['声明问题', timing?.issues.join('；') || '无已识别的格式问题；不构成独立验证'],
    ['本次快照（UTC）', observation.generatedAt], ['权威来源', task.source.path],
    ['等待记录问题（独立于任务历时）', timing?.waitingTable?.issues.join('；') || '无已识别的等待表问题'],
    ['等待记录（原文，未求和）', timing?.waiting || '未记录；不推断等待或净工作时长'],
  ]) facts.append(element('dt', label), element('dd', value || '未知'));
  timingObservations.set(section, { task, observation, epoch: summaryEpoch, current: matched && task.current });
  const basis = element('details', undefined, 'timing-basis'); basis.append(element('summary', '时间依据 · UTC、来源与原文'), facts);
  const current = snapshotCurrent && matched && task.current && task.source.mode === 'live' && !task.source.stale;
  section.append(timeLine(timing), element('p', `本地时间 ${localClock.zone} · 每项含 UTC 偏移`, 'timing-zone'),
    element('p', elapsedText(task, observation, current), 'task-elapsed'), waitingView(timing, observation, current), basis);
  return section;
}
function updateTimingFreshness() {
  for (const section of document.querySelectorAll('[data-timing-task], #task-timing-detail')) {
    const record = timingObservations.get(section);
    if (!record) continue;
    const current = snapshotCurrent && record.current && record.epoch === summaryEpoch && record.task.source.mode === 'live' && !record.task.source.stale;
    section.querySelector('.task-elapsed').textContent = elapsedText(record.task, record.observation, current);
    for (const node of section.querySelectorAll('[data-waiting-index]')) {
      const row = record.task.status.timing.waitingTable.rows[Number(node.dataset.waitingIndex)];
      const text = waitingState(row, record.observation, current);
      if (node.textContent !== text) node.textContent = text;
    }
  }
}

function taskLinks(task, { summary = false } = {}) {
  const section = element('div', undefined, 'task-links');
  const links = task.links;
  const parent = element('p');
  if (links?.kind === 'big' && links.parent.state === 'none') parent.textContent = '大task · 无所属父任务';
  else {
    parent.append(element('span', '所属大task：'));
    const registered = links?.parent.targetId && snapshot.tasks.find(item => item.id === links.parent.targetId);
    if (registered) {
      if (links.parent.state !== 'known') parent.append(element('span', '关系未知；登记资料：'));
      parent.append(taskButton(registered, `查看所属大task ${registered.id}`));
    }
    else parent.append(element('span', '未知'));
    if (links?.parent.state !== 'known') parent.append(element('span', ` · ${links?.parent.reason || '未声明'}`, 'muted'));
  }
  section.append(parent);
  if (!summary) section.append(element('p', `co-lead：${links?.coLead.state === 'known' ? links.coLead.value : `未知 · ${links?.coLead.reason || '未声明'}`}`));
  else if (links?.coLead.state !== 'known') section.append(element('p', '责任归属待核对', 'muted'));
  if (!summary && (links?.parent.record || links?.coLead.record)) {
    const raw = element('details', undefined, 'task-link-records');
    raw.append(element('summary', '关联声明原文'));
    if (links.parent.record) raw.append(element('p', links.parent.record));
    if (links.coLead.record) raw.append(element('p', links.coLead.record));
    section.append(raw);
  }
  return section;
}

function compactTask(task, subtitle, { summary = true } = {}) {
  const row = element('article', undefined, 'task-row');
  const text = element('div', undefined, 'task-copy');
  const title = element('div', undefined, 'task-heading');
  title.append(element('span', task.id, 'task-code'), element('h3', task.title));
  text.append(title);
  if (subtitle) text.append(element('p', subtitle));
  const allocation = element('p', undefined, 'allocation');
  allocation.dataset.allocation = task.id; allocation.dataset.compact = String(summary);
  allocation.textContent = allocationText(task, summary);
  text.append(summaryTiming(task), taskLinks(task, { summary }), allocation);
  row.append(text, taskButton(task));
  return row;
}
function tasksFor(ids) { return ids.map(id => snapshot.tasks.find(task => task.id === id)).filter(Boolean); }
function renderWorkstreams() {
  if (!snapshot) return;
  const filter = $('#filter').value;
  const tasks = snapshot.tasks.filter(task => filter === 'all' || (filter === 'unknown' ? !task.sourceCurrent || !task.status.human?.complete : /^in-progress/.test(task.status.branchState ?? '')));
  $('#workstreams').replaceChildren(...tasks.map(task => {
    const row = compactTask(task, undefined, { summary: false });
    const status = element('div', undefined, 'task-stages');
    status.append(badge(task.sourceCurrent ? `作者记录：${task.status.branchState || '未知'}` : '来源待同步'), element('span', `${task.progress.completed ?? '?'} / ${task.progress.total ?? '?'} 项`, 'muted'), badge('审查 / main：现场未核验'));
    row.querySelector('.task-copy').append(status);
    return row;
  }));
  $('#empty-filter').hidden = tasks.length > 0;
}
function renderSignal(selector, ids, kind, empty) {
  const groups = snapshot.overview[`${kind}Groups`] ?? ids.map(id => ({ parentId: null, relation: 'unknown', taskIds: [id] }));
  const entries = groups.map(group => {
    const section = element('section', undefined, 'signal-group');
    const parent = snapshot.tasks.find(task => task.id === group.parentId);
    const heading = element('h3', parent ? '关联任务 · ' : '关系未确认 · 独立记录');
    if (parent) heading.append(taskButton(parent, `${parent.id} ${parent.title}`));
    section.append(heading);
    if (parent) section.append(element('p', '按明确父关系归组；每项仍是该负责人自己的记录。', 'muted'));
    for (const task of tasksFor(group.taskIds)) {
      const row = compactTask(task, task.status.human[kind].text);
      const human = task.status.human;
      const priority = human.missing?.includes('优先级') ? '未知' : human.priority;
      row.querySelector('.task-copy').prepend(element('p', `负责人：${task.status.owner || '未知'} · 优先级：${priority}`, 'signal-owner'));
      section.append(row);
    }
    return section;
  });
  $(selector).replaceChildren(...(entries.length ? entries : [element('p', empty, 'empty-state')]));
}

function render() {
  const view = snapshot.overview;
  $('#page-title').textContent = view.phase ? `当前推进 ${view.phase}` : '当前阶段待补';
  $('#phase-note').textContent = '作者 status 摘要与声明关系；现场 Git、审查和 main 核验按需读取。';
  const active = tasksFor(view.activeIds);
  $('#active-work').replaceChildren(...(active.length ? active.map(task => compactTask(task, task.status.human.output)) : [element('p', '暂无已明确记录的进行中事项。', 'empty-state')]));
  $('#other-activity').hidden = !view.otherActiveIds.length;
  $('#other-activity-count').textContent = view.otherActiveIds.length;
  $('#other-activity-items').replaceChildren(...tasksFor(view.otherActiveIds).map(task => compactTask(task, task.status.human?.complete ? task.status.human.output : `摘要待补；已记录 ${task.progress.completed ?? '?'} / ${task.progress.total ?? '?'} 项完成`)));
  $('#next-deliveries').replaceChildren(...(view.deliveryIds.length ? tasksFor(view.deliveryIds).map(task => compactTask(task, task.status.human.next)) : [element('p', '下一交付摘要待负责人补充。', 'empty-state')]));
  renderSignal('#decisions', view.decisionIds, 'decision', '已明确的记录中，没有需要你决定的事项。');
  renderSignal('#blockers', view.blockerIds, 'blocker', '已明确的记录中，暂无当前阻塞。');
  $('#decision-note').textContent = view.unknownIds.length ? `${view.unknownIds.length} 项未完成记录的摘要或来源仍待补齐，详见下方。` : '未完成记录已提供当前摘要；历史记录见下方。';
  $('#unknown-count').textContent = view.unknownIds.length;
  $('#unknown-items').replaceChildren(...tasksFor(view.unknownIds).map(task => compactTask(task, task.sourceCurrent ? `摘要待补：${task.status.human?.missing.join('、') || '字段待核对'}` : '来源待同步，当前情况未知')));
  $('#history-count').textContent = view.historyIds.length;
  $('#history-items').replaceChildren(...tasksFor(view.historyIds).map(task => compactTask(task, task.status.human?.complete ? task.status.human.output : `已记录 ${task.progress.completed ?? '?'} / ${task.progress.total ?? '?'} 项完成；摘要待补`)));
  $('#source-count').textContent = snapshot.tasks.length;
  renderWorkstreams();
  $('#sync-state').textContent = summaryFailure ? '当前同步失败' : '已同步 · 作者记录';
  $('#sync-time').textContent = timestamp(snapshot.completedAt);
  $('#main-observation').textContent = '首页尚未观察 Git / main；打开任务详情才读取对应任务及 main。摘要时间不代表核验时间。';
  renderAssignments();
}

function invalidateDocument() {
  documentEpoch++; documentRequest?.abort(); documentRequest = undefined;
  $('#document-view').hidden = true;
  const image = $('#document-image'); image.onload = null; image.onerror = null; image.removeAttribute('src'); image.hidden = true;
}
function invalidateDetail() {
  selectionEpoch++; detailEpoch++; detailRequest?.abort(); detailRequest = undefined;
  invalidateDocument();
}
function sameSource(left, right) {
  return left && right && left.id === right.id && left.sourceKey === right.sourceKey
    && left.source.digest === right.source.digest && left.source.mode === right.source.mode;
}
function retainDetail(message) {
  // Background observations invalidate freshness, not the user's reading surface.
  const notice = $('#detail-update-notice'); if (notice) notice.textContent = message;
  const proof = $('#selected-proof'); if (!proof) return;
  proof.dataset.freshness = 'prior-observation';
  for (const node of proof.querySelectorAll('.badge.good')) node.classList.remove('good');
}
function syncSelectedSource() {
  if (!selectedTask) return;
  const next = snapshot.tasks.find(task => task.id === selectedTask.id);
  if (!sameSource(selectedTask, next)) {
    // Stop pending old reads, but retain already displayed text/images and focus.
    detailEpoch++; detailRequest?.abort(); detailRequest = undefined;
    documentEpoch++; documentRequest?.abort(); documentRequest = undefined;
  }
  selectedTask = next ?? selectedTask;
  retainDetail(!next ? '任务已不在当前登记中；保留上次读取内容，不视为当前核验。'
    : !sameSource(detailSource, next) ? '来源已变化；保留上次读取内容与文档，请显式刷新详情。'
      : '摘要已同步；详情与文档保留上次读取，现场核验未刷新。');
  $('#refresh-detail').disabled = !next;
}
async function refreshAssignments() {
  const epoch = ++assignmentEpoch;
  assignmentLoading = true; renderAssignments();
  assignmentRequest?.abort(); const controller = new AbortController(); assignmentRequest = controller;
  try {
    const response = await fetch('/api/assignments', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json();
    if (epoch !== assignmentEpoch) return;
    if (value.kind !== 'assignments' || value.version !== 1) throw new Error('领取观察格式不受支持');
    assignmentObservation = value; assignmentFailure = null;
  } catch (error) {
    if (epoch !== assignmentEpoch || error.name === 'AbortError') return;
    assignmentObservation = undefined; assignmentFailure = { at: new Date().toISOString(), message: error.message };
  }
  if (epoch !== assignmentEpoch) return;
  assignmentLoading = false; applyAssignments(); renderAssignments();
}
function refresh() {
  if (summaryFlight) return summaryFlight;
  const epoch = ++summaryEpoch;
  snapshotCurrent = false; updateTimingFreshness();
  if (selectedTask) retainDetail('摘要正在刷新；保留阅读内容，旧现场核验不代表本次同步。');
  $('#refresh').disabled = true;
  // Assignment latency never holds the summary request or its refresh control.
  void refreshAssignments();
  summaryFlight = (async () => {
    try {
      const response = await fetch('/api/summary', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.json();
      if (epoch !== summaryEpoch) return;
      if (value.kind !== 'summary' || value.version !== 1) throw new Error('摘要格式不受支持');
      snapshot = { ...value, tasks: value.tasks.map(task => ({ ...task, status: task.declarations })) };
      summaryFailure = null; snapshotCurrent = true; applyAssignments(); render(); $('#load-error').hidden = true;
      syncSelectedSource();
    } catch (error) {
      if (epoch !== summaryEpoch) return;
      summaryFailure = { at: new Date().toISOString(), message: error.message };
      $('#load-error').hidden = false; $('#load-error').textContent = `读取失败 ${timestamp(summaryFailure.at)}：${error.message}。${snapshot ? '保留上次摘要及其原时间，内容可能已过期。' : '请确认本地服务和登记路径后重试。'}`;
      $('#sync-state').textContent = '当前同步失败';
      if (selectedTask) retainDetail('摘要刷新失败；保留上次读取内容，现场核验未恢复。');
    } finally {
      if (epoch === summaryEpoch) { summaryFlight = undefined; $('#refresh').disabled = false; }
    }
  })();
  return summaryFlight;
}

function humanSignal(value) { return value?.state === 'none' ? '无' : value?.state === 'active' ? value.text : '未知，待负责人核对'; }
function addFact(list, label, value) { list.append(element('dt', label), element('dd', plain(value || '未知'))); }
function childTasks(parent) {
  const children = snapshot.tasks.filter(task => task.links?.kind === 'subtask'
    && task.links.parent.state === 'known' && task.links.parent.targetId === parent.id);
  if (!children.length) return null;
  const section = element('section', undefined, 'direct-children');
  section.setAttribute('aria-label', '直属子任务');
  section.append(element('h3', '直属子任务'), element('p', '以下是各子任务自己的记录，不代表父任务进度。', 'muted'));
  const labels = { planning: '计划中', implementation: '实施中', review: '审查中', integration: '待集成', delivered: '已交付' };
  for (const child of children) {
    const row = compactTask(child, child.status.human?.output || '当前产出待补');
    const delivery = child.status.human?.delivery;
    row.querySelector('.task-copy').append(element('p', `本片段阶段：${delivery?.source === 'explicit' ? labels[delivery.state] || '未知' : '未显式声明'}`, 'muted'));
    section.append(row);
  }
  return section;
}
function renderSelectedAssignments() {
  const content = $('#selected-assignments'); if (!content || !selectedTask) return;
  if (content.hasChildNodes()) {
    // Do not replace selected claim text while the reader selects or copies it.
    $('#selected-assignment-update').textContent = `${$('#assignment-observation').textContent} 此处保留打开详情时的领取记录；显式刷新详情可重新读取。`;
    return;
  }
  const task = snapshot.tasks.find(task => task.id === selectedTask.id);
  const update = element('p', $('#assignment-observation').textContent, 'muted'); update.id = 'selected-assignment-update';
  content.append(element('h3', '领取与写入范围'), update);
  if (!task || task.assignments === null) content.append(element('p', '领取状态未知；禁止据此新接手。', 'notice warning'));
  else if (!task.assignments.length) content.append(element('p', '尚无领取登记；接手前须核对。'));
  else for (const claim of task.assignments) content.append(assignmentFacts(claim));
}
function renderDetailShell(task, message = '正在读取选中任务的现场核验…') {
  const content = $('#detail-content'); content.replaceChildren();
  detailSource = task;
  const notice = element('p', '详情与文档按需读取；后台同步保留阅读内容，刷新详情会重新读取。', 'notice warning'); notice.id = 'detail-update-notice';
  const refreshButton = element('button', '刷新所选详情'); refreshButton.type = 'button'; refreshButton.id = 'refresh-detail';
  refreshButton.addEventListener('click', () => openTask(task.id));
  content.append(notice, refreshButton);
  content.append(element('p', '以下任务关联来自 status 声明；不表示父子现场核验。', 'muted'), element('h3', '任务关联'), taskLinks(task));
  const children = childTasks(task); if (children) content.append(children);
  for (const issue of task.source.issues) content.append(element('p', issue, 'notice warning'));
  const declarations = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [['Owner（作者记录）', task.status.owner], ['工作分支（作者记录）', task.status.branchState],
    ['检查（作者记录）', task.status.checks?.record], ['审查（作者记录）', task.status.reviewRecord], ['main（作者记录）', task.status.mainRecord],
    ['摘要读取时间', timestamp(task.source.readAt)], ['声明更新时间', timestamp(task.source.declaredUpdatedAt)]]) addFact(declarations, label, value);
  const assignments = element('section'); assignments.id = 'selected-assignments';
  const proof = element('section'); proof.id = 'selected-proof'; proof.append(element('p', message, 'muted'));
  content.append(declarations, assignments, proof); renderSelectedAssignments();
}
function openTask(id) {
  const task = snapshot?.tasks.find(task => task.id === id); if (!task) return;
  const navigatingInsideDialog = $('#task-dialog').open;
  if (!navigatingInsideDialog) returnFocus = { node: document.activeElement, taskId: document.activeElement?.dataset.openTask };
  invalidateDetail(); selectedTask = task;
  $('#detail-id').textContent = task.id; $('#detail-title').textContent = task.title;
  renderDetailShell(task);
  if (!$('#task-dialog').open) $('#task-dialog').showModal();
  $('#task-dialog').scrollTop = 0;
  if (navigatingInsideDialog) { $('#detail-title').tabIndex = -1; $('#detail-title').focus(); }
  void loadDetail(task);
}
async function loadDetail(summaryTask) {
  const token = { request: ++detailEpoch, epoch: selectionEpoch, summary: summaryEpoch, id: summaryTask.id, key: summaryTask.sourceKey, digest: summaryTask.source.digest };
  const active = () => detailEpoch === token.request && selectedTask?.id === token.id && selectionEpoch === token.epoch
    && selectedTask.sourceKey === token.key && selectedTask.source.digest === token.digest && $('#task-dialog').open;
  detailRequest?.abort(); const controller = new AbortController(); detailRequest = controller;
  try {
    const response = await fetch(`/api/task?${new URLSearchParams({ task: token.id })}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json(); if (!active()) return;
    if (value.kind !== 'task-detail' || value.version !== 1 || value.taskId !== token.id || value.sourceKey !== token.key || value.registryFingerprint !== snapshot.registryFingerprint) throw new Error('登记来源已变化，请刷新摘要');
    const matched = summaryEpoch === token.summary && value.consistency === 'matched' && value.statusDigestBefore === token.digest && value.statusDigestAfter === token.digest;
    renderTaskProof(value, matched);
  } catch (error) {
    if (!active() || error.name === 'AbortError') return;
    const retry = element('button', '重试现场核验'); retry.type = 'button';
    retry.addEventListener('click', () => { if (active()) openTask(selectedTask.id); });
    $('#selected-proof').replaceChildren(element('p', `现场核验未取得：${error.message}`, 'notice warning'), retry);
  }
}
function renderTaskProof(observation, matched) {
  const task = observation.task, content = $('#selected-proof'); content.replaceChildren();
  content.dataset.freshness = matched ? 'current-observation' : 'prior-observation';
  content.append(element('h3', '现场核验'), element('p', `本次核验 ${timestamp(observation.startedAt)} 至 ${timestamp(observation.completedAt)}。status一致仅指读取字节相同，不是Git与文件系统原子快照。`, 'muted'));
  if (matched) content.append(reviewBadge(task), mainBadge(task));
  else content.append(element('p', '观察期间来源变化或与摘要不一致；以下仅为本次旧观察，请刷新，不视为当前已核通过。', 'notice warning'));
  for (const issue of task.issues) content.append(element('p', issue, 'notice warning'));
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [
    ['Owner', task.status.owner], ['人类摘要缺口', task.status.human?.missing.join('、') || '无；摘要字段完整'], ['声明实现目标', task.status.implementation?.target], ['声明实现范围', task.status.implementation?.scopes.join('\n')], ['实现核验', JSON.stringify(task.implementationProof, null, 2)], ['Review 范围核验', JSON.stringify(task.review.proof ?? { state: '未执行', reason: '无可核验的 approval' }, null, 2)], ['工作分支', task.status.branchState], ['下一交付', task.status.human?.next || '未知，待负责人补充'], ['当前阻塞', humanSignal(task.status.human?.blocker)], ['用户决定', humanSignal(task.status.human?.decision)], ['历史风险与技术说明', task.status.risks],
    ['检查记录', task.status.checks.record], ['审查结论', `${plain(task.review.record)}\n目标：${task.review.target ?? '未绑定提交'}`], ['main 集成记录', `${plain(task.main.record)}\n${task.main.reason}\n方法：${task.main.method}\n实现目标：${task.main.target ?? '未知'}\n现场 main：${task.main.mainHead ?? '未知'}\n观察时间：${task.main.observedAt}`],
    ['权威 status', task.source.path], ['来源模式', task.source.mode === 'live' ? '权威 worktree' : task.source.mode === 'frozen' ? `冻结旧记录 ${task.source.frozenCommit}` : '缺失'],
    ['状态更新时间', timestamp(task.status.updatedAt)], ['文件修改时间', timestamp(task.source.modifiedAt)], ['本次读取时间', timestamp(task.source.syncedAt)],
    ['登记分支', task.branch], ['现场 Git', `${task.git.branch ?? '未知'}\n${task.git.head ?? 'HEAD 未知'}\n${task.git.dirty === null ? 'dirty 未知' : task.git.dirty ? `dirty；${task.git.changedFiles} 项变化` : 'clean'}`],
    ['owner 声明 HEAD', task.status.declaredHead], ['owner 声明 dirty', task.status.declaredDirty],
  ]) addFact(facts, label, value);
  content.append(timingDetails(task, observation, matched), facts, element('h3', '计划、状态与证据'));
  const documents = element('div', undefined, 'documents');
  const source = detailSource;
  for (const doc of task.documents) { const button = element('button', doc.title); button.type = 'button'; button.addEventListener('click', () => openDocument(task, doc, source)); documents.append(button); }
  content.append(documents, element('h3', 'Owner 的 TODO 记录'));
  const scroll = element('div', undefined, 'table-scroll'); const table = element('table', undefined, 'todo-list');
  const head = element('thead'); const header = element('tr'); for (const title of ['ID', '状态', 'Owner', '证据 / 检查']) header.append(element('th', title)); head.append(header); table.append(head);
  const body = element('tbody'); for (const todo of task.status.todos) { const row = element('tr'); for (const value of [todo.id, todo.state, todo.owner, plain(todo.evidence)]) row.append(element('td', value)); body.append(row); } table.append(body); scroll.append(table); content.append(scroll);
}

async function openDocument(task, doc, source) {
  const current = snapshot.tasks.find(item => item.id === task.id);
  if (!sameSource(source, current)) { retainDetail('文档入口属于上次来源；保留已读内容，请显式刷新详情后再读取。'); return; }
  documentRequest?.abort(); const controller = new AbortController(); documentRequest = controller;
  const token = { epoch: ++documentEpoch, selection: selectionEpoch, task: task.id, path: doc.path };
  const active = () => documentEpoch === token.epoch && selectionEpoch === token.selection && sameSource(source, selectedTask) && $('#task-dialog').open;
  $('#document-view').hidden = false; $('#document-title').textContent = doc.path; $('#document-error').hidden = true;
  $('#document-text').hidden = false; $('#document-text').textContent = '读取中…';
  const oldImage = $('#document-image'); oldImage.onload = null; oldImage.onerror = null; oldImage.removeAttribute('src');
  const image = element('img'); image.id = 'document-image'; image.alt = '任务证据截图'; image.hidden = true; oldImage.replaceWith(image);
  const url = `/api/document?${new URLSearchParams({ task: task.id, path: doc.path })}`;
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) { const failure = await response.json(); if (!active()) return; throw new Error(failure.error); }
    if (!active()) return;
    if (response.headers.get('content-type')?.startsWith('image/')) {
      await response.arrayBuffer(); if (!active()) return;
      image.onload = () => { if (active()) { image.hidden = false; $('#document-text').hidden = true; } };
      image.onerror = () => { if (active()) { $('#document-error').hidden = false; $('#document-error').textContent = '证据图片不可读取'; } };
      image.src = url;
    } else {
      const text = await response.text(); if (!active()) return; $('#document-text').textContent = text;
    }
  } catch (error) {
    if (!active() || error.name === 'AbortError') return;
    $('#document-text').textContent = ''; $('#document-error').hidden = false; $('#document-error').textContent = `资料不可读取：${error.message}`;
  }
  if (active()) $('#document-view').scrollIntoView({ block: 'start' });
}

const assignmentNote = element('p', '领取状态未知：等待独立观察。', 'muted small'); assignmentNote.id = 'assignment-observation';
$('#load-error').after(assignmentNote);
$('#close-dialog').addEventListener('click', () => $('#task-dialog').close());
$('#task-dialog').addEventListener('close', () => {
  // A queued close from the previous opening must not revoke a reopened detail.
  if ($('#task-dialog').open) return;
  invalidateDetail(); selectedTask = undefined; detailSource = undefined;
  const target = returnFocus?.node?.isConnected ? returnFocus.node : [...document.querySelectorAll('[data-open-task]')].find(node => node.dataset.openTask === returnFocus?.taskId);
  target?.focus(); returnFocus = undefined;
});
document.addEventListener('click', event => { const button = event.target.closest('[data-open-task]'); if (button) openTask(button.dataset.openTask); });
$('#refresh').addEventListener('click', refresh);
$('#filter').addEventListener('change', renderWorkstreams);
await refresh();
setInterval(() => { if (!document.hidden) void refresh(); }, 20000);
