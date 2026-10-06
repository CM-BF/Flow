import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {views,baseline} from '../public/architecture-data.js';
import {createDashboardServer} from '../src/server.mjs';
import {defaultRegistry} from '../src/registry.mjs';

test('curated architecture cites existing files at its fixed source commit and valid graph nodes',()=>{
  assert.match(baseline.commit,/^[a-f0-9]{40}$/);
  for(const view of views){
    const ids=new Set(view.nodes.map(node=>node.id));assert.equal(ids.size,view.nodes.length);
    for(const node of view.nodes){
      assert.ok(node.x>=0 && node.x+225<=view.width && node.y>=0 && node.y+80<=view.height);
      assert.ok(node.description && node.seam && node.locality);
      assert.match(node.source,/^(apps|packages|plans)\/[A-Za-z0-9_./-]+$/);
      execFileSync('git',['cat-file','-e',`${baseline.commit}:${node.source}`]);
    }
    for(const edge of view.edges){assert.ok(ids.has(edge.from));assert.ok(ids.has(edge.to));}
  }
});
test('architecture static assets stay within existing read-only loopback server policy',async t=>{
  const server=createDashboardServer(defaultRegistry());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const asset of ['/architecture.js','/architecture-data.js','/architecture.css']){
    const response=await fetch(base+asset);assert.equal(response.status,200);assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
    assert.equal((await fetch(base+asset,{method:'POST'})).status,405);
  }
  const rejectedHost = await new Promise((resolve,reject)=>{
    const request=http.get(`${base}/architecture-data.js`,{headers:{host:'evil.example'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
    request.on('error',reject);
  });
  assert.equal(rejectedHost,403);
  assert.equal((await fetch(base+'/api/source?path=apps/server/src/index.ts')).status,404);
  const html=await(await fetch(base)).text();assert.match(html,/id="architecture-panel"/);assert.match(html,/id="progress-panel"/);
});

test('fixed baseline separates integrated center and trusted host from later Web/runtime work',()=>{
  assert.equal(baseline.commit,'8f1481df880cf5077e1ddb9a8f302fe700a7ece8');
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  for(const route of ['registerGoalRoutes','registerConversationRoutes','registerPluginRoutes','registerAssistantRoutes']) assert.match(server,new RegExp(`${route}\\(app,`));
  const modules=views.find(view=>view.id==='modules');
  for(const id of ['goals','conversations','plugins','host']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'flow');
  for(const id of ['nextweb','nextbackend']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'planned');
  const web=source('apps/web/src/App.tsx');
  assert.match(web,/plugin-integration/);
  assert.doesNotMatch(web,/ConversationThread/);
  assert.match(source('apps/server/src/conversations/commands.ts'),/flow\.conversation_turns/);
});

test('state graph covers every active completed outcome and uncertain route without reviving the old task',()=>{
  const graph=views.find(view=>view.id==='states');
  const connects=(from,to)=>graph.edges.some(edge=>edge.from===from&&edge.to===to);
  for(const active of ['running','waiting','cancel']){
    assert.ok(connects(active,'completed'),`${active} must accept completed outcomes`);
    assert.ok(connects(active,'uncertain'),`${active} must show uncertain on loss`);
  }
  assert.ok(connects('completed','success'));
  assert.ok(connects('completed','terminal'));
  assert.ok(connects('uncertain','terminal'));
  assert.ok(connects('terminal','newtask'));
  assert.ok(graph.edges.every(edge=>edge.kind==='runtime'), 'state transitions are not compile-time imports');
  for(const final of ['success','terminal','uncertain']){
    assert.ok(!connects(final,'running'));
    assert.ok(!connects(final,'queued'));
  }
  assert.match(graph.nodes.find(node=>node.id==='completed').subtitle,/不是新状态/);
  assert.match(graph.nodes.find(node=>node.id==='newtask').locality,/不是旧task/);
});

test('current PG content and assistant provenance never become an implemented blob edge',()=>{
  const data=views.find(view=>view.id==='data');
  assert.equal(data.nodes.find(node=>node.id==='blob').kind,'planned');
  assert.ok(!data.edges.some(edge=>edge.to==='blob'||edge.from==='blob'));
  assert.equal(data.nodes.find(node=>node.id==='assistant').source,'apps/server/src/assistant/store.ts');
  const store=execFileSync('git',['show',`${baseline.commit}:apps/server/src/assistant/store.ts`],{encoding:'utf8'});
  assert.match(store,/saveDetail\(client/);
  assert.match(store,/sha256\(detail\.content\) !== row\.content_digest/);
  assert.match(store,/assistant_session_mismatch/);
  assert.match(data.nodes.find(node=>node.id==='ledger').description,/独立数据库|flow_coordination 数据库/);
});
