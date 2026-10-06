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
function stateBadge(value) { const states = { completed: ['已完成', 'good'], pending: ['待开始', ''], 'in-progress': ['进行中', 'active'], blocked: ['阻塞', 'bad'] }; const key = value?.match(/^[a-z-]+/)?.[0]; return badge(...(states[key] ?? ['未知', 'warning'])); }
function reviewBadge(task) { if (!task.current) return badge('待同步', 'warning'); const states = { approved: ['已审范围未变', 'good'], not_started: ['待审查', ''], changes_requested: ['需修复', 'bad'], outdated: ['待复审', 'warning'], unknown: ['未知', 'warning'] }; return badge(...(states[task.review.state] ?? states.unknown)); }
function mainBadge(task) {
  if (!task.current) return badge('来源待核实');
  if (task.main.current) return badge(task.main.method === 'ancestor' ? '已合入，范围未变' : '范围与 main 相同', 'good');
  return badge(task.main.historicalIntegrated ? '曾合入，当前待核验' : '集成待核实');
}
let snapshot;
let selectedTask;
let documentRequest;

function taskLinks(task) {
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
  section.append(parent, element('p', `co-lead：${links?.coLead.state === 'known' ? links.coLead.value : `未知 · ${links?.coLead.reason || '未声明'}`}`));
  if (links?.parent.record || links?.coLead.record) {
    const raw = element('details', undefined, 'task-link-records');
    raw.append(element('summary', '关联声明原文'));
    if (links.parent.record) raw.append(element('p', links.parent.record));
    if (links.coLead.record) raw.append(element('p', links.coLead.record));
    section.append(raw);
  }
  return section;
}

function compactTask(task, subtitle) {
  const row = element('article', undefined, 'task-row');
  const text = element('div', undefined, 'task-copy');
  const title = element('div', undefined, 'task-heading');
  title.append(element('span', task.id, 'task-code'), element('h3', task.title));
  text.append(title);
  if (subtitle) text.append(element('p', subtitle));
  const allocation = element('p', undefined, 'allocation');
  if (task.assignments === null) allocation.textContent = '领取状态未知';
  else if (!task.assignments?.length) allocation.textContent = '尚无领取登记；接手前须核对';
  else allocation.textContent = task.assignments.map(claim => `${claim.role === 'review' ? '只读审查' : claim.role === 'integration' ? '受控集成' : claim.state === 'handoff_pending' ? '交接待接收' : '已领取'} · ${claim.lead} / ${claim.worker}${claim.needsVerification ? ' · 待核对（仍占用）' : ''}${claim.matchesSource ? '' : ' · 进度来源待对齐'}`).join('；');
  text.append(taskLinks(task), allocation);
  row.append(text, taskButton(task));
  return row;
}
function tasksFor(ids) { return ids.map(id => snapshot.tasks.find(task => task.id === id)).filter(Boolean); }
function renderWorkstreams() {
  if (!snapshot) return;
  const filter = $('#filter').value;
  const tasks = snapshot.tasks.filter(task => filter === 'all' || (filter === 'unknown' ? !task.current || !task.status.human?.complete : /^in-progress/.test(task.status.branchState ?? '')));
  $('#workstreams').replaceChildren(...tasks.map(task => {
    const row = compactTask(task);
    const status = element('div', undefined, 'task-stages');
    status.append(task.current ? stateBadge(task.status.branchState) : badge('来源待同步'), element('span', `${task.progress.completed ?? '?'} / ${task.progress.total ?? '?'} 项`, 'muted'), reviewBadge(task), mainBadge(task));
    row.querySelector('.task-copy').append(status);
    return row;
  }));
  $('#empty-filter').hidden = tasks.length > 0;
}
function renderSignal(selector, ids, kind, empty) {
  const tasks = tasksFor(ids);
  $(selector).replaceChildren(...(tasks.length ? tasks.map(task => compactTask(task, task.status.human[kind].text)) : [element('p', empty, 'empty-state')]));
}
function render() {
  const view = snapshot.overview;
  const unregistered = snapshot.unregisteredAssignments ?? [];
  $('#unregistered-claims').hidden = !unregistered.length;
  $('#unregistered-claim-items').replaceChildren(...unregistered.map(claim => {
    const row = element('article', undefined, 'task-row');
    const copy = element('div', undefined, 'task-copy');
    copy.append(element('h3', claim.taskId), element('p', `${claim.lead} / ${claim.worker}`), element('p', `${claim.state} · ${claim.branch} · ${claim.worktree}`, 'allocation'));
    row.append(copy); return row;
  }));
  $('#page-title').textContent = view.phase ? `当前推进 ${view.phase}` : '当前阶段待补';
  $('#phase-note').textContent = view.phase ? '每项进展都能打开原始记录。' : '负责人补充阶段摘要后显示；现有计划仍可查看。';
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
  $('#unknown-items').replaceChildren(...tasksFor(view.unknownIds).map(task => compactTask(task, task.current ? `摘要待补：${task.status.human?.missing.join('、') || '字段待核对'}` : '来源待同步，当前情况未知')));
  $('#history-count').textContent = view.historyIds.length;
  $('#history-items').replaceChildren(...tasksFor(view.historyIds).map(task => compactTask(task, task.status.human?.complete ? task.status.human.output : `已记录 ${task.progress.completed ?? '?'} / ${task.progress.total ?? '?'} 项完成；摘要待补`)));
  $('#source-count').textContent = snapshot.tasks.length;
  renderWorkstreams();
  $('#sync-state').textContent = '已同步';
  $('#sync-time').textContent = timestamp(snapshot.generatedAt);
  const main = snapshot.main;
  $('#main-observation').textContent = `main 现场观察：${main.available ? `${main.branch} / ${main.head} / ${main.dirty ? '存在未提交变化' : 'clean'}` : '不可读取'}。观察时间 ${timestamp(main.observedAt)}。来源：${main.worktree}。集成以实现目标祖先关系或声明范围树核验。`;
}

async function refresh() {
  $('#refresh').disabled = true;
  try {
    const response = await fetch('/api/snapshot', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = await response.json(); render(); $('#load-error').hidden = true;
  } catch (error) {
    $('#load-error').hidden = false; $('#load-error').textContent = `读取失败：${error.message}。${snapshot ? '保留上次快照，内容可能已过期。' : '请确认本地服务和登记路径后重试。'}`;
    $('#sync-state').textContent = '当前同步失败';
  } finally { $('#refresh').disabled = false; }
}

function humanSignal(value) { return value?.state === 'none' ? '无' : value?.state === 'active' ? value.text : '未知，待负责人核对'; }
function addFact(list, label, value) { list.append(element('dt', label), element('dd', plain(value || '未知'))); }
function openTask(id) {
  const task = snapshot?.tasks.find(task => task.id === id); if (!task) return;
  const navigatingInsideDialog = $('#task-dialog').open;
  selectedTask = task; documentRequest?.abort();
  $('#detail-id').textContent = task.id; $('#detail-title').textContent = task.title;
  const content = $('#detail-content'); content.replaceChildren();
  content.append(element('h3', '任务关联'), taskLinks(task));
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
  content.append(element('h3', '领取与写入范围'));
  if (task.assignments === null) content.append(element('p', '领取状态未知；协调数据库不可用，禁止据此新接手。', 'notice warning'));
  for (const claim of task.assignments ?? []) {
    const assignment = element('dl', undefined, 'detail-facts');
    for (const [label, value] of [['领取 ID / version', `${claim.claimId} / ${claim.version}`], ['Lead / Worker', `${claim.lead} / ${claim.worker}`], ['状态 / role', `${claim.state} / ${claim.role}`], ['Branch / worktree', `${claim.branch}\n${claim.worktree}`], ['精确 scope', claim.scope.join('\n') || '无实现写权限'], ['来源', claim.origin === 'migration' ? `现有合法派工迁移；观察 ${timestamp(claim.observedAt)}` : '原子领取'], ['更新 / 核对', `${timestamp(claim.updatedAt)}${claim.needsVerification ? '；记录陈旧但仍占用，禁止抢占' : ''}`], ['接收方', claim.next ? `${claim.next.lead} / ${claim.next.worker}\n${claim.next.worktree}` : '无']]) addFact(assignment, label, value);
    content.append(assignment);
  }
  content.append(facts, element('h3', '计划、状态与证据'));
  const documents = element('div', undefined, 'documents');
  for (const doc of task.documents) { const button = element('button', doc.title); button.type = 'button'; button.addEventListener('click', () => openDocument(task, doc)); documents.append(button); }
  content.append(documents, element('h3', 'Owner 的 TODO 记录'));
  const scroll = element('div', undefined, 'table-scroll'); const table = element('table', undefined, 'todo-list');
  const head = element('thead'); const header = element('tr'); for (const title of ['ID', '状态', 'Owner', '证据 / 检查']) header.append(element('th', title)); head.append(header); table.append(head);
  const body = element('tbody'); for (const todo of task.status.todos) { const row = element('tr'); for (const value of [todo.id, todo.state, todo.owner, plain(todo.evidence)]) row.append(element('td', value)); body.append(row); } table.append(body); scroll.append(table); content.append(scroll);
  $('#document-view').hidden = true;
  if (!$('#task-dialog').open) $('#task-dialog').showModal();
  $('#task-dialog').scrollTop = 0;
  if (navigatingInsideDialog) { $('#detail-title').tabIndex = -1; $('#detail-title').focus(); }
}

async function openDocument(task, doc) {
  documentRequest?.abort(); const controller = new AbortController(); documentRequest = controller;
  $('#document-view').hidden = false; $('#document-title').textContent = doc.path; $('#document-error').hidden = true;
  $('#document-text').hidden = false; $('#document-text').textContent = '读取中…'; $('#document-image').hidden = true;
  const url = `/api/document?${new URLSearchParams({ task: task.id, path: doc.path })}`;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error((await response.json()).error);
    if (selectedTask?.id !== task.id) return;
    if (response.headers.get('content-type')?.startsWith('image/')) { $('#document-image').src = url; $('#document-image').hidden = false; $('#document-text').hidden = true; }
    else $('#document-text').textContent = await response.text();
  } catch (error) { if (error.name === 'AbortError') return; $('#document-text').textContent = ''; $('#document-error').hidden = false; $('#document-error').textContent = `资料不可读取：${error.message}`; }
  $('#document-view').scrollIntoView({ block: 'start' });
}

$('#close-dialog').addEventListener('click', () => $('#task-dialog').close());
$('#task-dialog').addEventListener('close', () => { documentRequest?.abort(); selectedTask = undefined; });
document.addEventListener('click', event => { const button = event.target.closest('[data-open-task]'); if (button) openTask(button.dataset.openTask); });
$('#refresh').addEventListener('click', refresh);
$('#filter').addEventListener('change', renderWorkstreams);
await refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 20000);
