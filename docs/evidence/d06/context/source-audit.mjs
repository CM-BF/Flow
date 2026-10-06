import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { baseline, views } from '../../../../apps/execution-dashboard/public/architecture-data.js';
const read = path => execFileSync('git', ['show', `${baseline.commit}:${path}`], { encoding: 'utf8' });
// These evidence selections are curated from the source review, not inferred from imports.
const selections = {
  'apps/server/src/index.ts': ['registerKnowledgeRoutes(app,', 'registerConversationContextRoutes(app,', 'registerGoalGraphRunRoutes(app,'],
  'apps/web/src/conversations/ConversationThread.tsx': ['<ConversationQueue projection=', 'composer.send({ startRun: false })', 'Replies appear when complete.', 'Steering is not supported.'],
  'apps/web/src/conversations/queue/ConversationQueue.tsx': ['pause', 'cancelCurrent'],
  'apps/server/src/knowledge/search.ts': ['v.version=s.current_version', 'WHERE s.project_id=$1', "plainto_tsquery('simple'", "locator: { kind: 'utf8-bytes'"],
  'apps/server/src/knowledge/storage.ts': ['INSERT INTO flow.knowledge_versions', 'INSERT INTO flow.knowledge_chunks', 'knowledge_version_conflict'],
  'apps/server/src/conversation-context/store.ts': ['resolveCitationsInTransaction(client, projectId, citations)', 'INSERT INTO flow.conversation_execution_inputs', 'input.conversation_id !== conversationId', 'WHERE id=$1 AND conversation_id=$2', 'executionInputForTask'],
  'apps/server/src/conversations/state.ts': ['contextReference(client, row.conversation_input_id)', 'user: { role:'],
  'apps/web/src/conversations/projection.ts': ['projectId: value.projectId', 'knowledgeContext'],
  'apps/server/src/goal-graph-runs/runner.ts': ['withRunnerAuthority', 'maxApplications === 0', 'commandInTransaction', 'stale_project_revision'],
  'apps/runner/src/goal-graph-tools/bind.ts': ['ownedCalls(input)', 'assertNativeGrant', 'client.goalGraphCommand'],
  'apps/runner/src/claude.ts': ['options.goalTools && options.goalGraphTools', 'Goal tools require an empty material scope'],
  'apps/runner/src/runtime.ts': ['bindGraphToolCapability', 'await execute(assignment'],
  'apps/server/src/package-artifacts/index.ts': ['fetchPackageArtifact', 'publishArtifact', "'npm-tarball'"],
  'apps/server/src/package-artifacts/storage.ts': ["algorithms: ['sha512']", "'package.tgz'", 'await rename(staged.directory'],
  'apps/web/src/data-renderers/registry.ts': ['createDataRendererRegistry', 'host.list().find', 'No trusted renderer for this data type'],
  'packages/contracts/src/conversations.ts': ['liveAssistantText: false', 'steer: false'],
  'plans/x01-plugin-management/plan.md': ['安装、配置、授予权限、启用', '第三方未知 npm'],
};
const evidence = [];
for (const [path, needles] of Object.entries(selections)) {
  const source = read(path), lines = source.split('\n');
  for (const needle of needles) {
    const line = lines.findIndex(text => text.includes(needle));
    assert.ok(line >= 0, `${path}: ${needle}`);
    evidence.push({ path, line: line + 1, text: lines[line] });
  }
}
const sourceFiles = [...new Set(views.flatMap(view => view.nodes.map(node => node.source)))].sort().map(path => {
  const source = read(path);
  return { path, sha256: createHash('sha256').update(source).digest('hex'), lines: source.split('\n').length };
});
const absent = ['apps/server/src/conversation-activity/index.ts', 'apps/server/src/native-assistant-stream/index.ts'];
for (const path of absent) assert.throws(() => execFileSync('git', ['cat-file', '-e', `${baseline.commit}:${path}`], { stdio: 'pipe' }));
const allFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline.commit], { encoding: 'utf8' }).split('\n');
assert.ok(!allFiles.some(path => /^packages\/storage\/migrations\/(020|022)-/.test(path)));
const report = { observedAt: new Date().toISOString(), baseline, sourceFiles, evidence, absent, absentMigrations: ['020-*', '022-*'], limits: 'Fixed source inspection only; no product model/database/service verification. Independent renderer and package modules are not App installation.' };
await writeFile('docs/evidence/d06/context/source-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Verified ${sourceFiles.length} node sources and ${evidence.length} curated evidence lines at ${baseline.commit}.`);
