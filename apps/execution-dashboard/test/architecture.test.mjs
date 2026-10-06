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
  assert.equal(baseline.commit,'f181d84b5fb3652d62e2a181acff442d42b3e066');
  assert.match(baseline.verifiedAt, /^2026-10-06T\d{2}:\d{2}:\d{2}Z$/);
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  for(const route of ['registerGoalRoutes','registerConversationRoutes','registerPluginRoutes','registerAssistantRoutes','registerExecutionProfileRoutes','registerConversationQueueRoutes','registerGoalToolRunRoutes','registerGoalGraphProposalRoutes','registerKnowledgeRoutes','registerConversationContextRoutes','registerGoalGraphRunRoutes','registerNativeActivityRoutes','registerAssistantStreamRoutes','registerActiveSteeringRoutes']) assert.ok(server.includes(`${route}(app,`), route);
  assert.ok(server.includes('registerShutdown(app,'));
  const modules=views.find(view=>view.id==='modules');
  for(const id of ['goals','conversations','plugins','host','profiles','queue','proposals','knowledge','context','graphruns','graphnative','packages','fetches','renderers','activity','stream','steering','nativecontrol','tui','interaction','nativehost','codexadapter']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'flow');
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

test('native concurrency is locally bounded and unknown claims block admission; shutdown is not safe cancellation',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const protocol=source('apps/runner/src/protocol-dispatch/index.ts');
  assert.match(protocol,/returnImmediately: true, historyLength: 0/);
  assert.match(protocol,/peer.snapshot\(\{ id: state.intent.remoteTaskId!, historyLength: 0 \}/);
  assert.match(protocol,/unsupported interaction or reconciliation/);
  assert.match(protocol,/client.protocolUncertain/);
  const runtime=source('apps/runner/src/runtime.ts');
  assert.match(runtime,/const completion = execute\(assignment/);
  assert.match(runtime,/const active = new Map/);
  assert.match(runtime,/active.size >= \(options.maxConcurrentAttempts \?\? 1\)/);
  assert.match(runtime,/journal.unresolved\(new Set\(active.keys\(\)\)\)/);
  assert.ok(runtime.indexOf('await journal.begin()') < runtime.indexOf('await client.claim('));
  const config=source('apps/runner/src/concurrency-configuration.ts');
  assert.match(config,/raw === undefined \? 1/); assert.match(config,/limit > 16/);
  assert.match(config,/mode === 'a2a' && limit !== 1/);
  assert.match(source('apps/runner/src/main.ts'),/FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS/);
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


test('Web knowledge is explicit project selection and frozen citations, not automatic file material',()=>{
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
  assert.match(thread,/<KnowledgeComposer/); assert.match(thread,/knowledge.capture\(\)/);
  assert.match(thread,/projection.queue.enqueue\(text, capture.knowledge\)/);
  assert.match(thread,/projection.send\(text, creation, capture.knowledge\)/);
  assert.match(thread,/projection.prepare\(creation\)/);
  const binding=source('apps/web/src/plugin-integration/knowledge.tsx');
  assert.match(binding,/controller\?\.freeze\(\)/);
  assert.match(binding,/selected/);
  assert.match(source('apps/web/src/conversation-context/receipts.ts'),/assertContextReceiptMatches/);
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

test('package download is opt-in durable work and does not install or execute plugins',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  assert.match(server,/if \(options.packageFetchHost\) packageWorker = await startPackageFetchWorker/);
  assert.match(server,/if \(options.packageFetchHost\) registerPackageFetchRoutes/);
  assert.match(source('apps/server/src/main.ts'),/FLOW_PACKAGE_FETCH_CONFIG/);
  const worker=source('apps/server/src/plugin-package-fetches/worker.ts');
  assert.match(worker,/pg_try_advisory_lock/);assert.match(worker,/await pool.connect\(\)/);
  assert.match(worker,/job.recovery[\s\S]*readPackageArtifact/);
  assert.match(source('apps/server/src/package-artifacts/storage.ts'),/verifier.digest\(\).toString\(\) !== integrity/);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='packages').locality,/不解压\/install\/import\/scripts\/enable/);
  assert.match(modules.nodes.find(node=>node.id==='fetches').description,/仅显式packageFetchHost/);
});

test('typed activity, renderer, streaming and steering are mounted in the same official Thread',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const thread=source('apps/web/src/conversations/ConversationThread.tsx');
  assert.match(thread,/<ConversationDataRenderers/);assert.match(thread,/<ConversationActivities/);
  assert.match(thread,/<ConversationStreams/); assert.match(thread,/<ConversationSteering/);
  assert.match(thread,/messageRepository: streamState.repository/);
  assert.match(source('apps/web/src/conversation-stream/messages.ts'),/streamConversationMessages/);
  const activity=source('packages/contracts/src/native-activity.ts');
  assert.match(activity,/65_536/);assert.match(activity,/truncated body is only a UTF-8 prefix/);
  assert.match(activity,/phase: z.enum\(\['observed', 'redacted', 'input-ready', 'running', 'succeeded', 'failed'\]\)/);
  assert.match(source('apps/server/src/native-activity/store.ts'),/unresolved && ended\?'unknown'/);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='activity').description,/input-ready不当作running/);
  assert.match(modules.nodes.find(node=>node.id==='stream').subtitle,/官方Thread已接/);
  assert.match(modules.nodes.find(node=>node.id==='renderers').subtitle,/App详情已接/);
});

test('assistant patches have explicit negotiation and durable settlement, not a task success signal',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const compatibility=source('apps/server/src/assistant-stream-compatibility/index.ts');
  assert.match(compatibility,/assistantStreamReadable !== true/);
  assert.match(compatibility,/supported = rawHeaders\[index \+ 1\] === 'patch-v1'/);
  assert.match(compatibility,/return count === 1 && supported/);
  assert.match(source('apps/server/src/conversations/state.ts'),/liveAssistantText: false/);
  assert.match(source('packages/client/src/index.ts'),/X-Flow-Assistant-Stream/);
  const contract=source('packages/contracts/src/assistant-stream.ts');
  assert.match(contract,/ASSISTANT_PATCH_BYTES = 8192/);assert.match(contract,/ASSISTANT_ATTEMPT_BYTES = 1048576/);
  assert.match(contract,/block-complete is a native block observation, NOT a successful Flow turn/);
  for(const key of ['replaceStreamIds','retainStreamIds','presentation-policy'])assert.ok(contract.includes(key));
  const queries=source('apps/server/src/assistant-stream/queries.ts');
  assert.match(queries,/sequence>\$3 ORDER BY sequence/);assert.match(queries,/patches.at\(-1\)\?\.sequence\?\?after/);
  for(const migration of ['020-native-activity.sql','022-assistant-stream.sql','023-plugin-package-fetches.sql','024-active-steering.sql'])assert.ok(source('packages/storage/migrations/'+migration).length);
});

test('steering UI is mounted but defaults off and requires explicit trusted center and runner configuration',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  assert.match(source('apps/server/src/index.ts'),/acceptCommands: options.activeSteering === true/);
  assert.match(source('apps/server/src/main.ts'),/parseActiveSteeringConfiguration\(process.env.FLOW_ACTIVE_STEERING\)/);
  assert.match(source('apps/server/src/active-steering-configuration.ts'),/raw === undefined \|\| raw === '0'/);
  assert.match(source('apps/runner/src/runtime.ts'),/if \(options.activeSteering && adapter.name === 'claude'\)/);
  assert.match(source('apps/runner/src/main.ts'),/activeSteering: loaded.activeSteering/);
  assert.match(source('apps/runner/src/configuration.ts'),/activeSteering: false/);
  assert.match(source('apps/runner/src/configuration.ts'),/configured.descriptor.ports.steering === 'flow.active-steering.v1'/);
  assert.match(source('apps/runner/src/claude.ts'),/if \(context.steering\) steering = new NativeSteeringHost/);
  const contract=source('packages/contracts/src/active-steering.ts');
  assert.match(contract,/type SteeringStatus = 'accepted' \| 'received' \| 'observed-consumed' \| 'rejected' \| 'unknown'/);
  assert.match(contract,/never independent proof of model compliance/);
  assert.match(source('apps/web/src/conversations/ConversationThread.tsx'),/<ConversationSteering/);
  assert.match(source('apps/web/src/plugin-integration/steering.tsx'),/steeringAdmission/);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='steering').locality,/不证明模型遵循/);
  assert.match(modules.nodes.find(node=>node.id==='nativecontrol').description,/默认无配置关闭/);
});


test('TUI and Codex source exists with explicit limits; production loader is not guessed from the adapter',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  assert.match(source('apps/tui/src/main.tsx'),/createInteractionController/);
  assert.match(source('apps/tui/src/main.tsx'),/FlowClient/);
  assert.match(source('packages/interaction/src/controller.ts'),/recover/);
  const codex=source('apps/runner/src/native-harness/codex/index.ts');
  assert.match(codex,/createTransport: CodexTransportFactory/);
  assert.match(codex,/describeNativeHarness/);
  assert.match(source('apps/runner/src/configuration.ts'),/configureClaudeHarness/);
  assert.doesNotMatch(source('apps/runner/src/configuration.ts'),/configureCodexHarness/);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='codexadapter').locality,/真实auth\/provider验收仍后继/);
  assert.match(modules.nodes.find(node=>node.id==='nextweb').description,/没有持久上传/);
  assert.throws(()=>execFileSync('git',['cat-file','-e',`${baseline.commit}:tools/personal-preview/web-release.mjs`],{stdio:'pipe'}));
});

test('task verification summary is not a per-artifact engineering approval or a deployment receipt',()=>{
  const source=execFileSync('git',['show',`${baseline.commit}:apps/server/src/evidence.ts`],{encoding:'utf8'});
  assert.match(source,/artifactVersion/); assert.match(source,/inputDigest/); assert.match(source,/nonempty/);
  const runtime=views.find(view=>view.id==='runtime');
  assert.match(runtime.nodes.find(node=>node.id==='verifier').description,/最新版本更新task汇总/);
  assert.match(runtime.nodes.find(node=>node.id==='center').locality,/须分别查服务owner回执/);
  assert.ok(!JSON.stringify(views).includes('个人center/runner b54'));
});
