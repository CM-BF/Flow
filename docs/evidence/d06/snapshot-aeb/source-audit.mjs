import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { baseline, views } from '../../../../apps/execution-dashboard/public/architecture-data.js';
const read = path => execFileSync('git', ['show', `${baseline.commit}:${path}`], { encoding: 'utf8' });
// These evidence selections are curated from the source review, not inferred from imports.
const selections = {
  'apps/server/src/index.ts': ['registerKnowledgeRoutes(app,', 'registerConversationContextRoutes(app,', 'registerGoalGraphRunRoutes(app,', 'registerNativeActivityRoutes(app,', 'registerAssistantStreamRoutes(app,', 'acceptCommands: options.activeSteering === true', 'if (options.packageFetchHost) packageWorker = await startPackageFetchWorker'],
  'apps/web/src/conversations/ConversationThread.tsx': ['<ConversationQueue projection=', 'composer.send({ startRun: false })', '<ConversationStreams', '<ConversationSteering', '<KnowledgeComposer', 'messageRepository: streamState.repository', 'capture.knowledge'],
  'apps/web/src/conversations/queue/ConversationQueue.tsx': ['pause', 'cancelCurrent'],
  'apps/server/src/knowledge/search.ts': ['v.version=s.current_version', 'WHERE s.project_id=$1', "plainto_tsquery('simple'", "locator: { kind: 'utf8-bytes'"],
  'apps/server/src/knowledge/storage.ts': ['INSERT INTO flow.knowledge_versions', 'INSERT INTO flow.knowledge_chunks', 'knowledge_version_conflict'],
  'apps/server/src/conversation-context/store.ts': ['resolveCitationsInTransaction(client, projectId, citations)', 'INSERT INTO flow.conversation_execution_inputs', 'input.conversation_id !== conversationId', 'WHERE id=$1 AND conversation_id=$2', 'executionInputForTask'],
  'apps/server/src/conversations/state.ts': ['contextReference(client, row.conversation_input_id)', 'user: { role:'],
  'apps/web/src/conversations/projection.ts': ['projectId: value.projectId', 'knowledgeContext'],
  'apps/server/src/goal-graph-runs/runner.ts': ['withRunnerAuthority', 'maxApplications === 0', 'commandInTransaction', 'stale_project_revision'],
  'apps/runner/src/goal-graph-tools/bind.ts': ['ownedCalls(input)', 'assertNativeGrant', 'client.goalGraphCommand'],
  'apps/runner/src/claude.ts': ['options.goalTools && options.goalGraphTools', 'Goal tools require an empty material scope'],
  'apps/runner/src/runtime.ts': ['bindGraphToolCapability', 'const completion = execute(assignment', 'const active = new Map', 'journal.unresolved(new Set(active.keys()))', 'active.size >= (options.maxConcurrentAttempts ?? 1)', "if (options.activeSteering && adapter.name === 'claude')"],
  'apps/server/src/package-artifacts/index.ts': ['fetchPackageArtifact', 'publishArtifact', "'npm-tarball'"],
  'apps/server/src/package-artifacts/storage.ts': ["algorithms: ['sha512']", "'package.tgz'", 'await rename(staged.directory'],
  'apps/web/src/data-renderers/registry.ts': ['createDataRendererRegistry', 'host.list().find', 'No trusted renderer for this data type'],
  'packages/contracts/src/conversations.ts': ['liveAssistantText?: boolean', 'steer: false'],
  'apps/server/src/plugin-package-fetches/worker.ts': ['await pool.connect()', 'pg_try_advisory_lock', 'job.recovery', 'await readPackageArtifact(host.root'],
  'apps/server/src/native-activity/store.ts': ["unresolved && ended?'unknown'", 'body:JSON.parse(detail.content)'],
  'apps/server/src/assistant-stream/queries.ts': ['nextCursor:patches.at(-1)?.sequence??after', "current.final_id?'final-available'"],
  'apps/server/src/assistant-stream/settlement.ts': ['replaceStreamIds:', 'retainStreamIds:', 'INSERT INTO flow.assistant_stream_settlements'],
  'apps/server/src/assistant-stream-compatibility/index.ts': ["entry.reference.stream?.kind !== 'assistant-stream'", 'assistantStreamReadable !== true', "rawHeaders[index + 1] === 'patch-v1'"],
  'apps/server/src/main.ts': ['FLOW_PACKAGE_FETCH_CONFIG', 'FLOW_ACTIVE_STEERING'],
  'apps/runner/src/active-steering/host.ts': ['class NativeSteeringHost'],
  'packages/contracts/src/active-steering.ts': ["'accepted' | 'received' | 'observed-consumed' | 'rejected' | 'unknown'", 'never independent proof of model compliance'],
  'packages/contracts/src/assistant-stream.ts': ['ASSISTANT_PATCH_BYTES = 8192', 'ASSISTANT_ATTEMPT_BYTES = 1048576', 'block-complete is a native block observation'],
  'packages/contracts/src/native-activity.ts': ['MAX_ACTIVITY_DETAIL_BYTES = 65_536', 'truncated body is only a UTF-8 prefix'],
  'apps/web/src/plugin-integration/react.tsx': ['ConversationActivities', 'MessageFooter'],
  'apps/web/src/conversation-stream/messages.ts': ['streamConversationMessages'],
  'apps/runner/src/concurrency-configuration.ts': ['raw === undefined ? 1', 'limit > 16', "mode === 'a2a' && limit !== 1"],
  'apps/runner/src/main.ts': ['FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', 'activeSteering: loaded.activeSteering'],
  'apps/runner/src/configuration.ts': ['activeSteering: false', "configureClaudeHarness(await readManifest(manifestFile, 'Claude'))"],
  'apps/runner/src/native-harness/descriptor.ts': ["protocol: 'flow.native-harness.v1'", 'ports:'],
  'apps/runner/src/native-harness/codex/index.ts': ['createTransport: CodexTransportFactory', 'describeNativeHarness'],
  'apps/runner/src/native-harness/codex/adapter.ts': ['createTransport', 'NativeExecutionError'],
  'apps/tui/src/main.tsx': ['createInteractionController', 'FlowClient', 'openIntentStore'],
  'packages/interaction/src/controller.ts': ['recover'],
  'apps/web/src/plugin-integration/knowledge.tsx': ['controller?.freeze()', 'this.projection.validateKnowledge(knowledge)'],
  'apps/web/src/plugin-integration/steering.tsx': ['this.session.steeringAdmission', 'class SteeringWorkspace'],
  'apps/web/src/conversation-stream/host.ts': ['class StreamConnectionBudget', '4 * 1024 * 1024'],
  'apps/server/src/evidence.ts': ['artifactVersion', 'inputDigest', 'nonempty'],
  'tools/personal-preview/static-web.mjs': ['verifyWebArtifact', 'startStaticWeb'],
  'docs/evidence/svc04/interface.md': ['publishPreviewWeb', 'Web release指针'],
  'apps/execution-dashboard/src/task-links.mjs': ['parseTaskLinks', 'resolveTaskLinks'],
  'plans/x01-plugin-management/plan.md': ['安装、配置、授予权限、启用', '第三方未知 npm'],
};
Object.assign(selections, {
  'apps/server/src/goal-delivery/index.ts': ['readGoalDelivery', "query.view === 'explanations'", 'planPage(plan', 'true);'],
  'apps/server/src/goal-delivery/metadata.ts': ['readPlanMetadata', 'readLiveMetadata', 'GOAL_DELIVERY_MAX_NODES'],
  'packages/interaction/src/goal/index.ts': ['createGoalSession', 'recover', 'goalDelivery'],
  'packages/interaction/src/goal/commands.ts': ['dispatch', 'checkReceipt'],
  'packages/client/src/conversation-acknowledgement.ts': ['decodeConversationCreated', 'decodeConversationTurnAccepted', 'parseAttachmentContextReceipt'],
  'packages/client/src/index.ts': ['attachmentUploadReceipt', 'contextHistory', 'decodeConversationTurnAccepted'],
  'apps/web/src/conversation-stream/projection.ts': ['@flow/interaction/stream'],
  'apps/web/src/conversation-activity/native/projection.ts': ['@flow/interaction/activity'],
  'apps/server/src/attachments/index.ts': ['026-attachment-resources.sql', 'registerAttachmentRoutes', 'upload-receipt'],
  'apps/server/src/context-transparency/store.ts': ['sources: context.sources.map', 'ORDER BY c.event_sequence DESC LIMIT 1', "reason: 'history-only'"],
  'apps/runner/src/engineering/workspace.ts': ['baseCommit', 'snapshot', 'leaseId'],
  'apps/runner/src/engineering/setup.ts': ['engineering-fixture', 'writeFile'],
  'apps/runner/src/engineering/checker.ts': ['baseline', 'digest'],
  'apps/runner/src/engineering/adapter.ts': ['artifactVersion', 'verification'],
  'apps/runner/src/engineering/calculator-checker.ts': ['calculator.mjs'],
  'apps/runner/src/engineering/calculator-capture.ts': ['assertOwnership'],
  'apps/runner/src/engineering/calculator-receipt.ts': ['not-attested', 'taskId', 'ownerVersion'],
  'apps/runner/src/engineering/native-writer.ts': ['NativeWriteAuthority', 'locked-no-fallback', 'runCodexExchange'],
  'apps/runner/src/engineering/native-policy.ts': ['calculator'],
  'apps/server/src/engineering/verification.ts': ['center does not run a remote checker', 'engineeringReceiptSchema.parse', 'engineering_completion_unverified'],
  'apps/runner/src/native-harness/codex/exchange.ts': ['runCodexExchange', 'Exactly one R06 consumer', "connected.request('thread/start'", "connected.request('turn/start'"],
  'apps/runner/src/native-harness/codex/launch.ts': ['createTransport'],
});
const evidence = [];
for (const [path, needles] of Object.entries(selections)) {
  const source = read(path), lines = source.split('\n');
  for (const needle of needles) {
    const line = lines.findIndex(text => text.includes(needle));
    assert.ok(line >= 0, `${path}: ${needle}`);
    evidence.push({ path, line: line + 1, text: lines[line] });
  }
}
const sourceFiles = [...new Set([...views.flatMap(view => view.nodes.map(node => node.source)), ...Object.keys(selections)])].sort().map(path => {
  const source = read(path);
  return { path, sha256: createHash('sha256').update(source).digest('hex'), lines: source.split('\n').length };
});
// Absence is limited to the exact planned contracts and publication module named by their owners.
const absent = ['apps/server/src/browser-session/index.ts'];
for (const path of absent) assert.throws(() => execFileSync('git', ['cat-file', '-e', `${baseline.commit}:${path}`], { stdio: 'pipe' }));
const allFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline.commit], { encoding: 'utf8' }).split('\n');
for (const name of ['020-native-activity.sql','022-assistant-stream.sql','023-plugin-package-fetches.sql','024-active-steering.sql','025-native-harness-sources.sql','026-attachment-resources.sql','027-context-observation-history.sql']) assert.ok(allFiles.includes('packages/storage/migrations/'+name));
const report = { observedAt: new Date().toISOString(), baseline, sourceFiles, evidence, absent, presentMigrations: ['020-native-activity.sql','022-assistant-stream.sql','023-plugin-package-fetches.sql','024-active-steering.sql','025-native-harness-sources.sql','026-attachment-resources.sql','027-context-observation-history.sql'], limits: 'Fixed source inspection only; no product model/database/service verification. App mounts stream, knowledge and steering; native execution is configurable but configured/provider capacity is not inferred. Codex explicit library selection exists but ordinary startup remains fixture/Claude. Engineering default is synthetic fixture; production native write authority and calculator receipt to center bridge are not claimed. Goal reader/controller exists, TUI goal consumer pending. 026 installed; 027 history-only has recorded attachment-only material gap; Web consumer pending. Steering stays opt-in; package fetch is not installation. Fixed artifact and backend deployment require separate owner receipts; no personal service inspected.' };
await writeFile('docs/evidence/d06/snapshot-aeb/source-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Verified ${sourceFiles.length} node sources and ${evidence.length} curated evidence lines at ${baseline.commit}.`);
