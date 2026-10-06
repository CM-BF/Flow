import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {views,baseline} from '../public/architecture-data.js';
import {createDashboardServer} from '../src/server.mjs';
import {defaultRegistry} from '../src/registry.mjs';

test('curated architecture cites existing files at its fixed source commit and valid graph nodes',()=>{
  assert.match(baseline.commit,/^[a-f0-9]{40}$/);
  assert.deepEqual(views.map(view=>view.id), ['runtime','modules','data','states','dependencies']);
  for(const view of views){
    assert.ok(Number.isFinite(view.width) && Number.isFinite(view.height));
    for(const group of view.groups) assert.ok(group.x >= 0 && group.y >= 0 && group.x + group.width <= view.width && group.y + group.height <= view.height);
    for(const route of Object.keys(view.routes ?? {})) assert.ok(view.edges.some(edge=>`${edge.from}:${edge.to}` === route));
    const ids=new Set(view.nodes.map(node=>node.id));assert.equal(ids.size,view.nodes.length);
    for(const node of view.nodes){
      assert.ok(node.x>=0 && node.x+225<=view.width && node.y>=0 && node.y+80<=view.height);
      assert.ok(node.description && node.seam && node.locality);
      assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
      assert.ok(['flow','external','planned','vendored'].includes(node.kind));
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
  assert.equal(baseline.commit,'0da869f7bad98771177472539b5a192365c15117');
  assert.match(baseline.verifiedAt, /^2026-10-06T\d{2}:\d{2}:\d{2}Z$/);
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  for(const route of ['registerGoalRoutes','registerConversationRoutes','registerPluginRoutes','registerAssistantRoutes','registerExecutionProfileRoutes','registerConversationQueueRoutes','registerGoalToolRunRoutes','registerGoalGraphProposalRoutes','registerKnowledgeRoutes','registerConversationContextRoutes','registerGoalGraphRunRoutes','registerNativeActivityRoutes','registerAssistantStreamRoutes','registerActiveSteeringRoutes','registerAttachmentRoutes','registerContextHistoryRoutes','registerGoalDeliveryRoutes']) assert.ok(server.includes(`${route}(app,`), route);
  assert.ok(server.includes('registerShutdown(app,'));
  const modules=views.find(view=>view.id==='modules');
  for(const id of ['goals','conversations','plugins','host','profiles','queue','proposals','knowledge','context','graphruns','graphnative','packages','fetches','renderers','activity','stream','steering','nativecontrol','tui','interaction','nativehost','codexadapter']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'flow');
  assert.equal(modules.nodes.find(node=>node.id==='workspace').kind,'flow');
  for(const id of ['nextbackend']) assert.equal(modules.nodes.find(node=>node.id===id).kind,'planned');
  assert.match(source('apps/web/src/App.tsx'),/ConversationThread/);
  assert.match(source('apps/web/src/plugin-integration/react.tsx'),/import\("\.\.\/plugin-management\/PluginManagement"\)/);
  assert.match(source('apps/web/src/conversations/ConversationThread.tsx'),/ConversationQueue projection=\{projection.queue\}/);
  assert.match(source('apps/web/src/conversations/ConversationThread.tsx'),/runtime.thread.composer.send\(\{ startRun: intent !== "queue" \}\)/);
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
  assert.match(thread,/projection.queue.enqueue\(captured.text, captured.selection.knowledge, captured.material\?\.capture.attachments\)/);
  assert.match(thread,/projection.send\(captured.text, captured.creation, captured.selection.knowledge, captured.material\?\.capture.attachments\)/);
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
  assert.match(source('apps/runner/src/configuration.ts'),/loadSelectedRunnerConfiguration/);
  assert.match(source('apps/runner/src/configuration.ts'),/configureCodexLaunch/);
  assert.match(source('apps/runner/src/main.ts'),/loadRunnerConfiguration\(process.env.FLOW_CLAUDE_MATERIALS_FILE\)/);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='codexadapter').locality,/真实auth\/provider验收仍后继/);
  assert.match(modules.nodes.find(node=>node.id==='web').description,/私有附件host和上传身份journal已接真实Thread\/Send\/Queue/);
  assert.match(modules.nodes.find(node=>node.id==='web').locality,/App仍页内Bearer/);
  assert.match(source('tools/personal-preview/web-release.mjs'),/verifyWebArtifact/);

});

test('task verification summary is not a per-artifact engineering approval or a deployment receipt',()=>{
  const source=execFileSync('git',['show',`${baseline.commit}:apps/server/src/evidence.ts`],{encoding:'utf8'});
  assert.match(source,/artifactVersion/); assert.match(source,/inputDigest/); assert.match(source,/nonempty/);
  const runtime=views.find(view=>view.id==='runtime');
  assert.match(runtime.nodes.find(node=>node.id==='verifier').description,/最新版本更新task汇总/);
  assert.match(runtime.nodes.find(node=>node.id==='center').locality,/须分别查服务owner回执/);
  assert.ok(!JSON.stringify(views).includes('个人center/runner b54'));
});


test('unified goal reader and shared interaction controller do not create a second scheduler',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const delivery=source('apps/server/src/goal-delivery/index.ts');
  for(const view of ['explanations','explanation','goal','input','decision','plan']) assert.ok(delivery.includes(`query.view === '${view}'`));
  assert.match(delivery,/true\);/);
  const goal=source('packages/interaction/src/goal/index.ts');
  assert.match(goal,/createGoalSession/); assert.match(goal,/recover/);
  assert.match(source('apps/web/src/conversation-stream/projection.ts'),/@flow\/interaction\/stream/);
  assert.match(source('apps/web/src/conversation-activity/native/projection.ts'),/@flow\/interaction\/activity/);
  assert.match(source('packages/client/src/conversation-acknowledgement.ts'),/parseAttachmentContextReceipt/);
  const modules=views.find(view=>view.id==='modules');
  assert.equal(modules.nodes.find(node=>node.id==='interaction').locality,'TUI已挂载现有goal reader和decision/cancel/recover；共享命令未包含progression授权或plan-confirmation。断开/reauth不自动重投或cancel。');
  const tui = source('apps/tui/src/main.tsx');
  assert.match(tui, /createGoalTerminal\(\{ client, connectionId, goalId/);
  assert.match(tui, /<GoalScreen controller=\{goal\}/);
  assert.match(tui, /queue: client, taskControl: client/);
  const types = source('packages/interaction/src/goal/types.ts');
  const commands = types.slice(types.indexOf('export type GoalSessionCommand ='), types.indexOf('export type GoalBodyReference ='));
  assert.deepEqual([...commands.matchAll(/kind: '([^']+)'/g)].map(match=>match[1]), ['goal','project','graph-plan','native-execute','decision','cancel']);
});

test('attachment and context history persistence have different identities and readiness limits',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  assert.match(source('apps/server/src/attachments/index.ts'),/026-attachment-resources.sql/);
  assert.match(source('apps/server/src/context-transparency/migration.ts'),/027-context-observation-history.sql/);
  assert.match(source('apps/server/src/conversation-context/store.ts'),/templateVersion: 2/);
  assert.match(source('apps/server/src/conversation-context/store.ts'),/freezeAttachments/);
  const history=source('apps/server/src/context-transparency/store.ts');
  assert.match(history,/ORDER BY c.event_sequence DESC LIMIT 1/);
  assert.match(history,/reason: 'history-only'/);
  // Fixed v2 deliberately reports an unknown inventory; no client-side token estimate is inferred.
  assert.match(history,/if \(context.templateVersion === 2\) return \{ executionInputDigest: context.executionInputDigest,/);
  assert.match(history,/materialRevisionDigest: null, materials: \{ state: 'unknown', reason: 'metadata-unavailable' \}/);
  assert.match(history,/state: 'known', sources: context.sources.map/);
  const data=views.find(view=>view.id==='data');
  assert.equal(data.nodes.find(node=>node.id==='history').locality,'附件-only与mixed均显式unknown inventory/metadata-unavailable，不能用knowledge子集冒全材料。历史读口尚无已核Web直接consumer，不等实时context窗口。');
  assert.match(data.nodes.find(node=>node.id==='attachments').locality,/lookup404不证/);
});

test('engineering fixture, native write authority, trusted checker and center receipt are separate',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  assert.match(source('apps/runner/src/main.ts'),/FLOW_ENGINEERING_SETUP_FILE/);
  assert.match(source('apps/runner/src/engineering/setup.ts'),/engineering-fixture/);
  assert.match(source('apps/runner/src/engineering/native-writer.ts'),/NativeWriteAuthority/);
  assert.match(source('apps/runner/src/engineering/native-writer.ts'),/locked-no-fallback/);
  assert.match(source('apps/runner/src/engineering/calculator-receipt.ts'),/not-attested/);
  assert.match(source('apps/server/src/engineering/verification.ts'),/engineeringReceiptSchema.parse/);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='nativewriter').locality,/没有production NativeWriteAuthority/);
  assert.match(modules.nodes.find(node=>node.id==='checker').locality,/中心已接v2声明\/收据校验/);
  assert.match(modules.nodes.find(node=>node.id==='checker').locality,/实际原生写权限、模型\/OS资格和生产启用另验/);
  assert.match(source('apps/server/src/evidence.ts'),/flow.engineering.native/);
  const verification=source('apps/server/src/engineering/verification.ts');
  assert.match(verification,/task.submission.engineering\?\.protocol === 'flow.engineering.v2'/);
  assert.match(verification,/await assertNativeEngineeringVerification\(client, task, attemptId, event, content\)/);
  assert.match(verification,/artifact_version=\$3/);
  const native=source('apps/server/src/engineering/native-verification.ts');
  for(const linkage of ['receipt.check.identity','receipt.writer.identity','receipt.writer.qualificationDigest','event.artifactVersion']) assert.ok(native.includes(linkage));
  assert.match(source('packages/contracts/src/engineering-native.ts'),/flow.engineering.native-receipt.v1/);
  assert.match(source('apps/server/src/engineering/native-profile.ts'),/host-qualification-required/);
  assert.match(source('apps/server/src/runners.ts'),/engineering-native/);
  assert.match(source('apps/runner/src/engineering/setup.ts'),/writeFile\(join\(directory, 'calculator.mjs'\), recipe.fixedSource\)/);
  assert.match(source('apps/runner/src/native-harness/codex/launch.ts'),/if \(!createTransport\) throw new Error/);
  assert.match(views.find(view=>view.id==='states').nodes.find(node=>node.id==='passed').seam,/flow.engineering.native-receipt.v1/);
  assert.match(modules.nodes.find(node=>node.id==='workspace').description,/默认setup仍是固定fixture writer/);
  assert.equal(modules.height,1375); assert.equal(views.find(view=>view.id==='data').height,1415);
});


test('browser authentication capability and actual App bearer mounting remain distinct',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  assert.ok(server.includes('await migrateBrowserSessions(pool)'));
  assert.ok(server.includes('registerBrowserSessionRoutes(app, authentication)'));
  const client=source('packages/client/src/index.ts');
  assert.match(client,/credentials: this.csrfToken \? 'include' : 'omit'/);
  assert.match(client,/headers.set\(BROWSER_SESSION_CSRF_HEADER, csrf\)/);
  assert.match(source('packages/contracts/src/browser-session.ts'),/X-Flow-CSRF/);
  assert.match(source('apps/web/src/App.tsx'),/new FlowClient\(\{ baseUrl, token, assistantStreamProtocol/);
  const web=views.find(view=>view.id==='runtime').nodes.find(node=>node.id==='web');
  assert.match(web.locality,/App仍使用页内Bearer/);
  const session=source('apps/server/src/browser-session/index.ts');
  assert.match(session,/cookieOrigin/); assert.match(session,/trustedOrigins/);
  assert.ok(source('packages/storage/migrations/028-browser-sessions.sql').length>0);
});

test('static installation and host phase authorization do not imply the unintegrated enable chain',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  assert.match(source('apps/server/src/index.ts'),/if \(options.pluginInstallHost\) registerPluginInstallationRoutes/);
  const host=source('apps/runner/src/plugins/host.ts');
  assert.ok(host.includes("await input.authorize(binding, 'load')"));
  assert.ok(host.includes("await input.authorize(binding, 'invoke')"));
  assert.ok(host.indexOf("authorize(binding, 'load')")<host.indexOf("authorize(binding, 'invoke')"));
  assert.match(host,/OUTCOME_UNKNOWN/);
  assert.ok(source('packages/storage/migrations/029-plugin-material-installs.sql').length>0);
  const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline.commit],{encoding:'utf8'}).split('\n');
  for(const absent of ['packages/contracts/src/plugin-runtime.ts','packages/contracts/src/native-activity-body.ts']) assert.ok(!paths.includes(absent));
  assert.ok(!paths.some(path=>path.startsWith('apps/server/src/plugin-runtime/')));
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='nextbackend').description,/X01 37cf的enable\/binding及完整claim\/执行链仍未集成/);
  assert.match(modules.nodes.find(node=>node.id==='activity').locality,/旧CHAT05\/020基础活动已main/);
});

test('owner confirmation and bounded progression reuse the existing center authorities',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const server=source('apps/server/src/index.ts');
  for(const route of ['registerGoalProgressionRoutes','registerGoalPlanConfirmationRoutes']) assert.ok(server.includes(`${route}(app,`));
  const advance=source('apps/server/src/goal-progression/advance.ts');
  assert.match(advance,/limit > 20/); assert.match(advance,/await executeGoalNode\(/);
  assert.match(advance,/halted/);
  const confirmation=source('apps/server/src/goal-plan-confirmation/store.ts');
  assert.match(confirmation,/proposal\.proposal_digest !== input\.proposalDigest/);
  assert.match(confirmation,/applyProposalInTransaction/);
  assert.match(confirmation,/authorizeProgressionInTransaction/);
  for(const file of ['030-goal-progression.sql','031-goal-plan-confirmations.sql']) assert.ok(source('packages/storage/migrations/'+file).length>0);
  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='proposals').locality,/不是保存即执行或无限自主规划/);
});

test('frozen Claude message settings are distinct from the real Web host and unintegrated TUI settings',()=>{
  const source=file=>execFileSync('git',['show',`${baseline.commit}:${file}`],{encoding:'utf8'});
  const admission=source('apps/server/src/conversations/message-settings.ts');
  assert.match(admission,/checkClaudeTurnSettingsAllowed\(snapshot/);
  assert.match(admission,/message_settings_profile_mismatch/);
  assert.match(admission,/message_settings_resume_unsupported/);
  assert.match(source('apps/runner/src/claude-message-settings.ts'),/requested/);
  assert.ok(source('packages/storage/migrations/032-claude-message-settings.sql').length>0);
  assert.match(source('apps/web/src/execution-profiles/ExecutionProfilePicker.tsx'),/export function MessageSettingsPicker/);
  const thread=source('apps/web/src/conversations/ConversationThread.tsx');
  assert.doesNotMatch(thread,/MessageSettingsPicker/);
  assert.match(thread,/projection.send\(captured.text, captured.creation, captured.selection.knowledge, captured.material\?\.capture.attachments\)/);
  const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline.commit],{encoding:'utf8'}).split('\n');
  assert.ok(!paths.some(path=>path.startsWith('packages/interaction/src/message-settings/')));
  const commands=source('packages/interaction/src/commands.ts');
  assert.deepEqual([...commands.matchAll(/type: z.literal\('([^']+)'\)/g)].map(match=>match[1]),
    ['help','conversations','open','profiles','new','send','turn','page','activity','detail','reply','back','queue','pause','resume','cancel','recover','disconnect','quit']);
  const interactionTypes=source('packages/interaction/src/types.ts');
  assert.ok(interactionTypes.includes("export type InteractionClient = Pick<FlowClient, 'conversations' | 'conversation' | 'conversationTurns' | 'executionProfiles' | 'createConversation' | 'submitConversationTurn'>;"));
  assert.ok(source('apps/tui/src/main.tsx').includes('createInteractionController({ client, observe: client, queue: client, taskControl: client, connectionId, intents:'));

  const modules=views.find(view=>view.id==='modules');
  assert.match(modules.nodes.find(node=>node.id==='profiles').locality,/真实ConversationThread仍调用创建profile与既有Send\/Queue接口/);
});
