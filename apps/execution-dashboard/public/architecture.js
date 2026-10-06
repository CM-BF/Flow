import { baseline, views } from './architecture-data.js';
const $ = selector => document.querySelector(selector);
const svgNamespace = 'http://www.w3.org/2000/svg';
function html(tag, text, className) { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; }
function svg(tag, attributes, text) { const result = document.createElementNS(svgNamespace, tag); for (const [key,value] of Object.entries(attributes)) result.setAttribute(key, value); if (text !== undefined) result.textContent = text; return result; }
const kinds = { flow: 'Flow 自有', external: '外部 package / 系统', planned: '分支开发 / 研究中', vendored: '引入源码 · Flow 维护' };
let selectedView = views[0];
const viewportStates = new Map(views.map(view => [view.id, { mode: 'fit', zoom: 1 }]));
let selectedNode;
const canvas = $('#architecture-canvas');
const viewport = $('#architecture-viewport');
function sourceLink(source) {
  const link = html('a', source);
  link.href = `${baseline.repository}/blob/${baseline.commit}/${source}`;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function selectNode(node) {
  selectedNode = node.id;
  for (const item of canvas.querySelectorAll('[data-node]')) item.setAttribute('aria-pressed', String(item.dataset.node === selectedNode));
  $('#architecture-node-title').textContent = node.label;
  const details = $('#architecture-node-content');
  details.replaceChildren(html('p', kinds[node.kind], `architecture-kind ${node.kind}`), html('p', node.description));
  for (const [title,text] of [['Interface',node.seam],['局部修改与验证',node.locality]]) details.append(html('h3',title),html('p',text));
  const disclosure=html('details'); disclosure.append(html('summary','源码依据（固定版本）'),sourceLink(node.source)); details.append(disclosure);
}
function drawNode(node) {
  const group = svg('g', { transform:`translate(${node.x} ${node.y})`, class:`architecture-node ${node.kind}`, role:'button', tabindex:'0', 'aria-label':`${node.label}，${node.subtitle}，${kinds[node.kind]}`, 'aria-pressed':'false', 'data-node':node.id });
  group.append(svg('rect',{width:225,height:80,rx:8}),svg('text',{x:14,y:29,class:'node-title'},node.label),svg('text',{x:14,y:53,class:'node-subtitle'},node.subtitle));
  group.addEventListener('click',()=>selectNode(node));
  group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectNode(node);}});
  return group;
}
function drawEdge(edge) {
  const a=selectedView.nodes.find(node=>node.id===edge.from), b=selectedView.nodes.find(node=>node.id===edge.to);
  let x1=a.x+112, y1=a.y+80, x2=b.x+112, y2=b.y;
  let d, lx, ly;
  if(a.y===b.y){
    const forward=b.x>a.x; x1=a.x+(forward?225:0); x2=b.x+(forward?0:225); y1=a.y+(forward?40:10); y2=b.y+(forward?40:10);
    if(forward){d=`M${x1},${y1} L${x2},${y2}`;lx=(x1+x2)/2;ly=y1-10;}
    else {d=`M${x1},${y1} C${x1-30},${y1-66} ${x2+30},${y2-66} ${x2},${y2}`;lx=(x1+x2)/2;ly=y1-48;}
  } else { const mid=(y1+y2)/2; d=`M${x1},${y1} L${x1},${mid} L${x2},${mid} L${x2},${y2}`;lx=(x1+x2)/2;ly=mid-8; }
  const group=svg('g',{class:`architecture-edge ${edge.kind}`});
  group.append(svg('path',{d,'marker-end':'url(#architecture-arrow)'}));
  const custom=selectedView.routes?.[`${edge.from}:${edge.to}`];
  if(custom){d=custom.d;lx=custom.x;ly=custom.y;group.firstChild.setAttribute('d',d);}
  const textWidth=Math.max(40,edge.label.length*8+14);
  group.append(svg('rect',{x:lx-textWidth/2,y:ly-12,width:textWidth,height:19,rx:3}),svg('text',{x:lx,y:ly+1,'text-anchor':'middle'},edge.label));return group;
}
function sizeCanvas() {
  if ($('#architecture-panel').hidden) return;
  const state = viewportStates.get(selectedView.id);
  if (state.mode === 'fit') {
    const style = getComputedStyle(viewport);
    const availableWidth = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (availableWidth <= 0) return;
    state.zoom = Math.min(1, Math.max(.42, availableWidth / selectedView.width));
  }
  const { zoom } = state;
  canvas.setAttribute('width',String(Math.round(selectedView.width*zoom)));
  canvas.setAttribute('height',String(Math.round(selectedView.height*zoom)));
  $('#architecture-zoom').textContent=`${Math.round(zoom*100)}%`;
}
function draw() {
  $('#architecture-summary').textContent=selectedView.summary;
  $('#architecture-rules').replaceChildren(...(selectedView.rules??[]).map(text=>html('li',text)));
  $('#architecture-rules').hidden=!selectedView.rules?.length;
  canvas.setAttribute('viewBox',`0 0 ${selectedView.width} ${selectedView.height}`);
  canvas.setAttribute('aria-label',`${selectedView.title}；节点可用键盘选择，详细解释显示在图后`);
  const defs=svg('defs',{}), marker=svg('marker',{id:'architecture-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});
  marker.append(svg('path',{d:'M0 0 L10 5 L0 10 z',class:'arrow-head'}));defs.append(marker);canvas.replaceChildren(defs);
  for(const group of selectedView.groups) canvas.append(svg('rect',{x:group.x,y:group.y,width:group.width,height:group.height,rx:12,class:'architecture-boundary'}),svg('text',{x:group.x+16,y:group.y+27,class:'boundary-title'},group.label));
  for(const edge of selectedView.edges) canvas.append(drawEdge(edge));
  for(const node of selectedView.nodes) canvas.append(drawNode(node));
  selectNode(selectedView.nodes[0]); sizeCanvas();
}
const viewSelect=$('#architecture-view');
for(const view of views){const option=html('option',view.title);option.value=view.id;viewSelect.append(option);}
viewSelect.addEventListener('change',()=>{selectedView=views.find(view=>view.id===viewSelect.value);draw();});
function changeZoom(delta) {
  const state = viewportStates.get(selectedView.id);
  state.mode = 'manual';
  state.zoom = Math.min(2, Math.max(.4, state.zoom + delta));
  sizeCanvas();
}
$('#architecture-zoom-in').addEventListener('click',()=>changeZoom(.2));
$('#architecture-zoom-out').addEventListener('click',()=>changeZoom(-.2));
$('#architecture-fit').addEventListener('click',()=>{viewportStates.get(selectedView.id).mode='fit';sizeCanvas();});
function snapshotLink(short = false) {
  const link = html('a', short ? baseline.commit.slice(0, 8) : baseline.commit);
  link.href = `${baseline.repository}/tree/${baseline.commit}`;
  link.title = baseline.commit; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
const verified = baseline.verifiedAt.replace('T', ' ').replace('Z', ' UTC');
$('.architecture-heading p').replaceChildren('固定源码快照 ', snapshotLink(true), ` · 源码核验于 ${verified} · 非实时运行拓扑`);
$('#architecture-baseline').append(html('span', `源码核验于 ${verified}；基线 `), snapshotLink(), html('p', '这是固定源码版本的结构说明，不是实时运行拓扑。分支开发中的能力不计入已实现；代码已集成不代表常驻服务已升级。'));
function activateTab() {
  const architecture=location.hash==='#architecture';
  $('#architecture-panel').hidden=!architecture; $('#progress-panel').hidden=architecture;
  $('#nav-progress').setAttribute('aria-current',architecture?'false':'page'); $('#nav-architecture').setAttribute('aria-current',architecture?'page':'false');
  $('#refresh').hidden=architecture;
  if(architecture)sizeCanvas();
}
window.addEventListener('hashchange',activateTab);
new ResizeObserver(()=>{if(viewportStates.get(selectedView.id).mode==='fit')sizeCanvas();}).observe(viewport);
draw(); activateTab();
