import assert from 'node:assert/strict';
import { currentDeliveries } from '../../../apps/server/src/goals/state.ts';
const count = 20; let reads = 0;
const binding = i => ({ nodeId: `n${i}`, executionId: `e${i}`, taskId: `t${i}`, artifactId: `a${i}`, artifactVersion: 'a'.repeat(64), detailId: `d${i}` });
const nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, dependsOn: [i-1,i-2].filter(j => j>=0).map(j => `n${j}`) }));
const executions = new Map(nodes.map((node, i) => [`e${i}`, { id: `e${i}`, node_id: node.id, task_id: `t${i}`, input_version: 1,
  dependencies: [i-1,i-2].filter(j => j>=0).map(binding), artifact_detail_id: `d${i}`,
  task: { get status() { reads++; return 'succeeded'; }, verification_status: 'passed', latest_artifact_id: `a${i}`, latest_artifact_version: 'a'.repeat(64) } }]));
const provenance = { authorization: { nodes: nodes.map(node => ({ nodeId: node.id, externalDependencies: [] })) }, executions: new Map(nodes.map((node, i) => [node.id, `e${i}`])) };
const state = { goal: { projectId: 'p' }, project: { graph: { nodes } }, knowledgeHeads: new Map(),
  inputs: new Map(nodes.map(node => [node.id, { version: 1, input: {} }])), nodes: new Map(nodes.map((node, i) => [node.id, { latest_execution_id: `e${i}`, accepted_binding: null }])), executions,
  progressions: { scopes: new Map([['grant', provenance]]), executionScopes: new Map(nodes.map((_, i) => [`e${i}`, 'grant'])) } };
assert.equal(currentDeliveries(state).isCurrent(executions.get('e19')), true);
console.log(JSON.stringify({ nodes: count, edges: nodes.reduce((sum,n)=>sum+n.dependsOn.length,0), operationalStatusReads: reads, maximum: 400, databaseCreated: false, providerCalls: 0 }));
assert(reads <= 400, 'Shared validity must not re-walk every dependency path exponentially');

state.inputs.set('n0', { version: 2, input: {} });
assert.equal(currentDeliveries(state).isCurrent(executions.get('e19')), false);
state.inputs.set('n0', { version: 1, input: {} });
const first = executions.get('e0'); executions.set('e0', { ...first, task: { ...first.task, status: 'uncertain' } });
assert.equal(currentDeliveries(state).isCurrent(executions.get('e19')), false);
console.log('Changed input and uncertain producer both invalidate fresh reads; no cross-read cache.');
