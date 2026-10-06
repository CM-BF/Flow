const $ = id => document.getElementById(id);
const AGENTS = 128, STEPS = 64, BATCH_EVENTS = 1024;
const events = Array.from({ length: AGENTS * STEPS }, (_, index) => ({ id: index + 1, agent: index % AGENTS, step: Math.floor(index / AGENTS) + 1 }));
let timeline, mode, requestSequence = 0, clicks = 0, activeProbe, busy = false;
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function digestText(text) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, '0')).join(''); }
function metrics(id, values) {
  $(id).replaceChildren(...Object.entries(values).flatMap(([label, value]) => {
    const term = document.createElement('dt'), detail = document.createElement('dd');
    term.textContent = label; detail.textContent = value; return [term, detail];
  }));
}
async function fetchMeasured(path) {
  const url = `${path}${path.includes('?') ? '&' : '?'}sample=${++requestSequence}`;
  const start = performance.now();
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`请求失败：${response.status}`);
  const text = await response.text();
  const fetchTextMs = performance.now() - start;
  const parsing = performance.now();
  const value = JSON.parse(text);
  const parseMs = performance.now() - parsing;
  const timing = performance.getEntriesByName(new URL(url, location.href).href).at(-1);
  if (!timing || timing.encodedBodySize <= 0) throw new Error('浏览器未提供实际传输计数');
  const uncompressedBytes = new TextEncoder().encode(text).length;
  if (uncompressedBytes !== Number(response.headers.get('X-Uncompressed-Bytes'))) throw new Error('解压字节校验失败');
  return { value, measurement: { uncompressedBytes, encodedBodyBytes: timing.encodedBodySize, transferBytes: timing.transferSize, parseMs, fetchTextMs } };
}
async function loadTimeline(selected) {
  performance.clearResourceTimings(); mode = selected;
  const fetched = await fetchMeasured(`/api/timeline?mode=${mode}`);
  timeline = fetched.value.entries;
  if (timeline.length !== 32) throw new Error('时间线事件数错误');
  if (mode === 'folded' && timeline.some(entry => JSON.stringify(Object.keys(entry.reference).sort()) !== '["id","title"]')) throw new Error('引用不是id/title');
  $('timeline').replaceChildren(...timeline.slice(0, 5).map(entry => {
    const item = document.createElement('li'), text = document.createElement('span'), subtitle = document.createElement('small');
    text.textContent = entry.text; subtitle.textContent = (entry.tool ?? entry.reference).title;
    item.append(text, subtitle); return item;
  }));
  $('expand').disabled = false; $('detail').hidden = true;
  $('payload-status').textContent = `已读取 32 条，预览前 5 条。当前：${mode === 'full' ? '完整结果' : '按需详情'}。`;
  metrics('payload-metrics', { '时间线未压缩': `${fetched.measurement.uncompressedBytes.toLocaleString()} B`, '实际压缩正文': `${fetched.measurement.encodedBodyBytes.toLocaleString()} B`, 'JSON 解析': `${fetched.measurement.parseMs.toFixed(3)} ms` });
  return fetched.measurement;
}
async function expandFirst() {
  const start = performance.now();
  const fetched = mode === 'full' ? null : await fetchMeasured(`/api/details/${timeline[0].reference.id}`);
  const value = fetched?.value ?? timeline[0].tool;
  $('detail').textContent = value.content; $('detail').hidden = false;
  const expandDomMs = performance.now() - start;
  const digest = await digestText(value.content);
  if (digest !== value.digest || value.content.length !== 8192) throw new Error('展开内容摘要错误');
  $('payload-status').textContent += ' 第一条详情已核验。';
  return { expandDomMs, detail: fetched?.measurement ?? null, contentDigest: digest, correct: true };
}
async function runA(selected) {
  const timelineMeasurement = await loadTimeline(selected);
  const expanded = await expandFirst();
  const requests = performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.startsWith('/api/')).length;
  if (requests !== (selected === 'full' ? 1 : 2)) throw new Error('详情请求数错误');
  const timelineDigest = await digestText(JSON.stringify(timeline.map(entry => ({ id: entry.id, text: entry.text, reference: { id: (entry.tool ?? entry.reference).id, title: (entry.tool ?? entry.reference).title } }))));
  return { mode: selected, timeline: timelineMeasurement, ...expanded, requests, timelineDigest,
    expandedTotal: { uncompressedBytes: timelineMeasurement.uncompressedBytes + (expanded.detail?.uncompressedBytes ?? 0), encodedBodyBytes: timelineMeasurement.encodedBodyBytes + (expanded.detail?.encodedBodyBytes ?? 0), transferBytes: timelineMeasurement.transferBytes + (expanded.detail?.transferBytes ?? 0), parseMs: timelineMeasurement.parseMs + (expanded.detail?.parseMs ?? 0) } };
}
function resetAgents() {
  $('agents').replaceChildren(...Array.from({ length: AGENTS }, (_, index) => {
    const cell = document.createElement('span'); cell.append(document.createTextNode(`${index + 1}\n0/${STEPS}`)); return cell;
  }));
  return [...$('agents').children].map(cell => cell.firstChild);
}
$('interaction').addEventListener('click', event => {
  $('click-count').textContent = String(++clicks);
  if (activeProbe) { activeProbe.resolve({ queuedControlDelayMs: performance.now() - activeProbe.requestedAt, trusted: event.isTrusted }); activeProbe = undefined; }
});
async function runB(selected) {
  const nodes = resetAgents();
  await nextFrame();
  let domMutations = 0, writes = 0, checksum = 0;
  const state = new Uint32Array(AGENTS), seen = new Set(), longTasks = [];
  const observer = new MutationObserver(records => { domMutations += records.length; });
  observer.observe($('agents'), { subtree: true, characterData: true });
  const supportsLongTasks = PerformanceObserver.supportedEntryTypes.includes('longtask');
  const longObserver = supportsLongTasks ? new PerformanceObserver(list => { longTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration }))); }) : null;
  longObserver?.observe({ type: 'longtask' });
  const start = performance.now();
  const interaction = new Promise(resolve => { activeProbe = { requestedAt: performance.now(), resolve }; });
  setTimeout(() => $('interaction').click(), 0);
  const display = agent => { nodes[agent].data = `${agent + 1}\n${state[agent]}/${STEPS}`; writes++; };
  const consume = event => { if (seen.has(event.id)) throw new Error('重复逻辑事件'); seen.add(event.id); checksum += event.id; state[event.agent] = event.step; };
  if (selected === 'immediate') {
    for (const event of events) { consume(event); display(event.agent); }
  } else {
    for (let offset = 0; offset < events.length; offset += BATCH_EVENTS) {
      const dirty = new Set();
      for (const event of events.slice(offset, offset + BATCH_EVENTS)) { consume(event); dirty.add(event.agent); }
      for (const agent of dirty) display(agent);
      if (offset + BATCH_EVENTS < events.length) await nextFrame();
    }
  }
  const completionMs = performance.now() - start;
  const probe = await interaction;
  await nextFrame(); await nextFrame();
  domMutations += observer.takeRecords().length; observer.disconnect();
  if (longObserver) { longTasks.push(...longObserver.takeRecords().map(entry => ({ startTime: entry.startTime, duration: entry.duration }))); longObserver.disconnect(); }
  const expectedChecksum = events.length * (events.length + 1) / 2;
  const correct = seen.size === events.length && checksum === expectedChecksum && state.every(value => value === STEPS) && nodes.every((node, index) => node.data === `${index + 1}\n${STEPS}/${STEPS}`) && domMutations === writes;
  if (!correct) throw new Error('逻辑事件或DOM最终状态不一致');
  const inWindow = longTasks.filter(entry => entry.startTime + entry.duration > start && entry.startTime < start + completionMs);
  const result = { mode: selected, logicalEvents: seen.size, checksum, finalState: Array.from(state), writes, domMutations, completionMs, ...probe, longTasksSupported: supportsLongTasks, longTasks: inWindow, longTaskCount: inWindow.length, longTaskTotalMs: inWindow.reduce((sum, entry) => sum + entry.duration, 0), correct };
  $('event-status').textContent = `${selected === 'immediate' ? '逐条' : '批量'}更新完成。8,192 个事件全部保留，128 个最终状态一致。`;
  metrics('event-metrics', { '真实 DOM 变更': domMutations.toLocaleString(), '排队控制动作延迟（代理）': `${probe.queuedControlDelayMs.toFixed(2)} ms`, '长任务（>50 ms）': String(inWindow.length), '处理到DOM赋值完成': `${completionMs.toFixed(2)} ms` });
  return result;
}
async function exclusively(work) {
  if (busy) throw new Error('请等待当前样例结束');
  busy = true;
  const controls = ['full', 'folded', 'expand', 'immediate', 'batched'].map($);
  for (const control of controls) control.disabled = true;
  try { return await work(); }
  finally { busy = false; for (const control of controls) control.disabled = false; $('expand').disabled = !timeline; }
}
function action(button, work) { $(button).addEventListener('click', async () => { try { await exclusively(work); } catch (error) { $('payload-status').textContent = error.message; } }); }
action('full', () => loadTimeline('full')); action('folded', () => loadTimeline('folded')); action('expand', expandFirst);
action('immediate', () => runB('immediate')); action('batched', () => runB('batched'));
$('theme').addEventListener('click', () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('theme').textContent = dark ? '切换浅色' : '切换深色'; });
resetAgents();
window.lab = { runA: mode => exclusively(() => runA(mode)), runB: mode => exclusively(() => runB(mode)), ready: true, parameters: { agents: AGENTS, steps: STEPS, batchEvents: BATCH_EVENTS } };
document.body.dataset.ready = 'true';
