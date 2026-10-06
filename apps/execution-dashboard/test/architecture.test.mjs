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

test('fixed snapshot separates integrated Web and center capabilities from later UI work',()=>{
  assert.equal(baseline.commit,'115b0dbdfa02db5483f9e9699852682ce699633c');
  assert.match(baseline.verifiedAt, /^2026-10-06T\d{2}:\d{2}:\d{2}Z$/);
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  for(const route of ['registerGoalRoutes','registerConversationRoutes','registerPluginRoutes','registerAssistantRoutes','registerExecutionProfileRoutes','registerConversationQueueRoutes','registerGoalToolRunRoutes','registerGoalGraphProposalRoutes','registerKnowledgeRoutes','registerConversationContextRoutes','registerGoalGraphRunRoutes']) assert.ok(server.includes(`${route}(app,`), route);
  assert.ok(server.includes('registerShutdown(app,'));
  const modules=views.find(view=>view.id==='modules');
  for(const id of ['goals','conversations','plugins','host','profiles','queue','proposals','knowledge','context','graphruns','graphnative','packages','renderers']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'flow');
  for(const id of ['nextweb','nextbackend']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'planned');
  assert.match(source('apps/web/src/App.tsx'),/ConversationThread/);
  assert.match(source('apps/web/src/plugin-integration/react.tsx'),/import\("\.\.\/plugin-management\/PluginManagement"\)/);
  assert.match(source('apps/web/src/conversations/ConversationThread.tsx'),/ConversationQueue projection=\{projection.queue\}/);
  assert.match(source('apps/web/src/conversations/ConversationThread.tsx'),/composer.send\(\{ startRun: false \}\)/);
  assert.match(modules.nodes.find(node=>node.id==='queue').locality,/跨reload原key恢复未完成/);
  assert.match(source('apps/web/src/conversations/ConversationThread.tsx'),/ExecutionProfilePicker/);
  assert.match(source('apps/server/src/conversations/admission.ts'),/flow\.conversation_turns/);
});

test('integrated queue and graph proposal descriptions preserve explicit admission and application',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const queue=source('apps/server/src/conversation-queue/queries.ts');
  assert.match(queue,/state='waiting' AND sequence>\$2/);
  assert.match(queue,/queueRevision: conversation.queue_revision/);
  const admission=source('apps/server/src/conversations/admission.ts');
  assert.ok(admission.includes("automatic && ['failed', 'cancelled', 'uncertain'].includes(task.status)"));
  assert.match(admission,/conversation_resume_unavailable/);
  const controls=source('apps/server/src/conversation-queue/controls.ts');
  assert.match(controls,/loadConversation\(client, conversationId, true\)/);
  assert.match(controls,/expectedTaskId/);
  const proposals=source('apps/server/src/goal-graph-proposals/store.ts');
  assert.match(proposals,/proposal_mismatch/); assert.match(proposals,/stale_project_revision/);
  assert.match(proposals,/applyProjectCommand/);
  assert.match(source('apps/server/src/goal-graph-proposals/index.ts'),/014-goal-graph-proposals.sql/);
});

test('transport optimization and shutdown do not imply parallel execution or safe cancellation',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const protocol=source('apps/runner/src/protocol-dispatch/index.ts');
  assert.match(protocol,/returnImmediately: true, historyLength: 0/);
  assert.match(protocol,/peer.snapshot\(\{ id: state.intent.remoteTaskId!, historyLength: 0 \}/);
  assert.match(protocol,/unsupported interaction or reconciliation/);
  assert.match(protocol,/client.protocolUncertain/);
  assert.match(source('apps/runner/src/runtime.ts'),/await execute\(assignment/);
  assert.match(source('apps/server/src/shutdown/index.ts'),/unacknowledged outcomes unknown/);
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


test('knowledge and context are exact PG references, not automatically selected Web material',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const search=source('apps/server/src/knowledge/search.ts');
  assert.match(search,/v.version=s.current_version/); assert.match(search,/WHERE s.project_id=\$1/);
  assert.match(search,/plainto_tsquery\('simple'/); assert.match(search,/locator: \{ kind: 'utf8-bytes'/);
  const context=source('apps/server/src/conversation-context/store.ts');
  assert.match(context,/resolveCitationsInTransaction\(client, projectId, citations\)/);
  assert.match(context,/conversation_execution_inputs/); assert.match(context,/input.conversation_id !== conversationId/);
  assert.match(context,/WHERE id=\$1 AND conversation_id=\$2/);
  assert.match(source('apps/web/src/conversations/projection.ts'),/projectId: value.projectId/);
  const thread=source('apps/web/src/conversations/ConversationThread.tsx');
  assert.doesNotMatch(thread,/knowledgeSearch|knowledgeResolve|conversationContext\(/);
  const data=views.find(view=>view.id==='data');
  for(const id of ['knowledge','context']) assert.equal(data.nodes.find(node=>node.id===id).kind,'flow');
});

test('graph run authority and native graph tools retain separate purposes and bounded commands',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const graph=source('apps/server/src/goal-graph-runs/runner.ts');
  assert.match(graph,/withRunnerAuthority/); assert.match(graph,/maxApplications === 0/);
  assert.match(graph,/commandInTransaction/); assert.match(graph,/stale_project_revision/);
  const bind=source('apps/runner/src/goal-graph-tools/bind.ts');
  assert.match(bind,/assertNativeGrant/); assert.match(bind,/ownedCalls/);
  assert.match(source('apps/runner/src/runtime.ts'),/bindGraphToolCapability/);
  assert.match(source('apps/runner/src/claude.ts'),/options.goalTools && options.goalGraphTools/);
  assert.match(source('apps/web/src/execution-profiles/selection.ts'),/configured-readonly/);
});

test('package artifacts and message renderers are modules without product activation',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const artifact=source('apps/server/src/package-artifacts/index.ts');
  assert.match(artifact,/fetchPackageArtifact/); assert.match(artifact,/publishArtifact/);
  assert.match(source('apps/server/src/package-artifacts/storage.ts'),/verifier.digest\(\).toString\(\) !== integrity/);
  assert.doesNotMatch(source('apps/server/src/index.ts'),/package-artifacts/);
  const registry=source('apps/web/src/data-renderers/registry.ts');
  assert.match(registry,/createDataRendererRegistry/); assert.match(registry,/host.list\(\).*state !== "active"/);
  for(const path of ['apps/web/src/App.tsx','apps/web/src/conversations/ConversationThread.tsx','apps/web/src/plugin-integration/session.ts']) assert.doesNotMatch(source(path),/data-renderers|ConversationDataRenderers/);
  const contracts=source('packages/contracts/src/conversations.ts');
  assert.match(contracts,/liveAssistantText: false/); assert.match(contracts,/steer: false/);
  for(const path of ['apps/server/src/conversation-activity/index.ts','apps/server/src/native-assistant-stream/index.ts']) assert.throws(()=>execFileSync('git',['cat-file','-e',`${baseline.commit}:${path}`],{stdio:'pipe'}));
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='packages').locality,/不解压\/install\/import\/scripts\/enable/);
  assert.match(modules.nodes.find(node=>node.id==='renderers').subtitle,/App尚未接/);
});
