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
function excerpt(value, length = 140) { const content = plain(value); return content.length > length ? `${content.slice(0, length)}…` : content; }
function timestamp(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未记录'; }
function stateBadge(value) { const states = { completed: ['已完成', 'good'], pending: ['待开始', ''], 'in-progress': ['进行中', 'active'], blocked: ['阻塞', 'bad'] }; const key = value?.match(/^[a-z-]+/)?.[0]; return badge(...(states[key] ?? ['未知', 'warning'])); }
function reviewBadge(task) { if (!task.current) return badge('待同步', 'warning'); const states = { approved: ['已通过', 'good'], not_started: ['待审查', ''], changes_requested: ['需修复', 'bad'], outdated: ['待复审', 'warning'], unknown: ['未知', 'warning'] }; return badge(...(states[task.review.state] ?? states.unknown)); }
function checkBadge(task) { if (!task.current) return badge('待同步', 'warning'); if (task.status.checks.state === 'passed' && (task.status.checks.target !== task.git.head || task.git.dirty)) return badge('历史通过', 'warning'); const states = { passed: ['记录通过', 'good'], failed: ['记录失败', 'bad'], not_run: ['未运行', ''], unknown: ['待核对', 'warning'] }; return badge(...(states[task.status.checks.state] ?? states.unknown)); }
function mainBadge(task) { if (!task.main.current || !task.current) return badge('待同步', 'warning'); if (/未集成|尚未集成|未合并/.test(task.main.record)) return badge('未集成'); return badge('见集成记录'); }
let snapshot;
let selectedTask;
let documentRequest;

function renderWorkstreams() {
  if (!snapshot) return;
  const filter = $('#filter').value;
  const tasks = snapshot.tasks.filter(task => task.role === '工作线').filter(task => filter === 'all' || (filter === 'attention' ? task.issues.length || task.review.state !== 'approved' || !task.main.current : /in-progress|实现中|进行中/.test(task.status.branchState ?? '')));
  $('#workstreams').replaceChildren(...tasks.map(task => {
    const row = element('article', undefined, 'workline');
    const identity = element('div');
    const title = element('div', undefined, 'work-title'); title.append(element('span', task.id, 'task-code'), element('h3', task.title));
    identity.append(title, element('p', task.status.owner || 'Owner 未知', 'owner'));
    const progress = element('div'); progress.append(element('p', excerpt(task.status.branchState || '当前状态未知', 100), 'progress-note'), element('span', `${task.current ? '' : '旧记录 / 待核实：'}TODO ${task.progress.completed ?? '未知'} / ${task.progress.total ?? '未知'} 已完成`, 'progress-count'));
    if (task.issues.length) progress.append(element('p', task.issues[0], 'source-warning'));
    const stages = element('div', undefined, 'stages');
    for (const [label, pill] of [['检查', checkBadge(task)], ['独立审查', reviewBadge(task)], ['main 集成', mainBadge(task)]]) { const stage = element('div'); stage.append(element('span', label, 'stage-label'), pill); stages.append(stage); }
    const meta = element('div', undefined, 'work-meta'); meta.append(element('span', `更新 ${timestamp(task.status.updatedAt)}`), element('span', `HEAD ${task.git.head?.slice(0, 10) ?? '未知'}`), element('span', task.git.dirty === null ? 'Git 未知' : task.git.dirty ? `${task.git.changedFiles} 项未提交` : '工作树 clean'), element('span', `${task.source.mode === 'live' ? '权威来源' : '冻结 / 缺失'}：${task.worktree.split('/').pop()}`));
    row.append(identity, progress, stages, taskButton(task), meta); return row;
  }));
  $('#empty-filter').hidden = tasks.length > 0;
}

function renderMilestones() {
  const titles = { F00: '基础契约与骨架', C01: '控制中心', R01: 'Runner 执行', I01: 'M1 集成验收' };
  const milestones = Object.entries(titles).map(([id, title]) => ({ id, title, todo: snapshot.milestones.todos.find(todo => todo.id === id) }));
  $('#milestone-note').textContent = snapshot.milestones.current ? '来源：FLOW-003 owner 状态记录；各工作线的更新见下方。' : 'FLOW-003 来源缺失或待同步；以下仅展示已有记录，不能作为当前验收结论。';
  $('#milestones').replaceChildren(...milestones.map(({ id, title, todo }) => { const node = element('div', undefined, 'milestone'); const line = element('div'); line.append(element('span', id, 'milestone-code'), stateBadge(todo?.state)); node.append(line, element('h3', title), element('p', todo ? excerpt(todo.evidence, 80) : '总计划未记录此项状态')); return node; }));
}

function renderNotes(selector, field, tasks, fallback) {
  const notes = tasks.filter(task => task.status[field]);
  $(selector).replaceChildren(...(notes.length ? notes.map(task => { const note = element('article', undefined, 'note'); note.append(taskButton(task, task.id), element('p', excerpt(task.status[field], field === 'next' ? 150 : 120))); return note; }) : [element('p', fallback, 'muted')]));
}

function render() {
  renderMilestones(); renderWorkstreams();
  const lines = snapshot.tasks.filter(task => task.role === '工作线');
  renderNotes('#next-deliveries', 'next', lines, 'Owner 尚未记录下一交付。');
  renderNotes('#risks', 'risks', lines, 'Owner 尚未提供风险记录；不代表没有阻塞。');
  renderNotes('#decisions', 'decisions', snapshot.tasks, '尚无明确用户决定记录；请从工作线详情核对未决事项。');
  $('#plans').replaceChildren(...snapshot.tasks.filter(task => task.role !== '工作线').map(task => { const button = taskButton(task, `${task.id}  ${task.title}`); button.className = 'plan-link'; button.append(element('span', `${task.current ? '' : '待同步 · '}${task.progress.completed ?? '未知'} / ${task.progress.total ?? '未知'} 项记录完成`)); return button; }));
  $('#sync-state').textContent = `已读取 ${snapshot.tasks.length} 个权威登记来源`;
  $('#sync-time').textContent = `同步 ${timestamp(snapshot.generatedAt)}`;
  const main = snapshot.main;
  $('#main-observation').textContent = `main 现场观察：${main.available ? `${main.branch} / ${main.head} / ${main.dirty ? '存在未提交变化' : 'clean'}` : '不可读取'}。来源：${main.worktree}。与 owner 记录的 HEAD 不一致时显示待同步。`;
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

function addFact(list, label, value) { list.append(element('dt', label), element('dd', plain(value || '未知'))); }
function openTask(id) {
  const task = snapshot?.tasks.find(task => task.id === id); if (!task) return;
  selectedTask = task; documentRequest?.abort();
  $('#detail-id').textContent = task.id; $('#detail-title').textContent = task.title;
  const content = $('#detail-content'); content.replaceChildren();
  for (const issue of task.issues) content.append(element('p', issue, 'notice warning'));
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [
    ['Owner', task.status.owner], ['工作分支', task.status.branchState], ['下一交付', task.status.next], ['阻塞 / 风险', task.status.risks], ['用户决定', task.status.decisions],
    ['检查记录', task.status.checks.record], ['审查结论', `${plain(task.review.record)}\n目标：${task.review.target ?? '未绑定提交'}`], ['main 集成记录', `${plain(task.main.record)}\n${task.main.current ? '记录 HEAD 与现场一致' : '未与现场 HEAD 同步，集成状态待核实'}`],
    ['权威 status', task.source.path], ['来源模式', task.source.mode === 'live' ? '权威 worktree' : task.source.mode === 'frozen' ? `冻结旧记录 ${task.source.frozenCommit}` : '缺失'],
    ['状态更新时间', timestamp(task.status.updatedAt)], ['文件修改时间', timestamp(task.source.modifiedAt)], ['本次读取时间', timestamp(task.source.syncedAt)],
    ['登记分支', task.branch], ['现场 Git', `${task.git.branch ?? '未知'}\n${task.git.head ?? 'HEAD 未知'}\n${task.git.dirty === null ? 'dirty 未知' : task.git.dirty ? `dirty；${task.git.changedFiles} 项变化` : 'clean'}`],
    ['owner 声明 HEAD', task.status.declaredHead], ['owner 声明 dirty', task.status.declaredDirty],
  ]) addFact(facts, label, value);
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
