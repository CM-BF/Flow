import { randomUUID } from 'node:crypto';
import { MAX_PROJECT_EDGES, MAX_PROJECT_NODES, type ProjectChange, type ProjectNode } from '../../../../packages/contracts/src/projects.js';
import { HttpError } from '../database.js';

type NodeReference = { nodeId: string; expectedVersion: number };
function referencedNode(nodes: ProjectNode[], reference: NodeReference, role: 'node' | 'parent' | 'dependency'): ProjectNode {
  const node = nodes.find(candidate => candidate.id === reference.nodeId);
  if (!node) throw new HttpError(409, `${role}_not_found`, `The ${role} must belong to this project.`);
  if (node.version !== reference.expectedVersion) throw new HttpError(409, `stale_${role}_version`, `Reload the current ${role} version.`);
  return node;
}
function increaseVersion(node: ProjectNode): void {
  if (node.version === 2_147_483_647) throw new HttpError(409, 'node_version_exhausted', 'The node version limit is reached.');
  node.version += 1;
}
function assertAcyclic(nodes: ProjectNode[], relation: 'parent' | 'dependency'): void {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const visiting = new Set<string>();
  const complete = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new HttpError(409, `${relation}_cycle`, `The ${relation} graph must remain acyclic.`);
    if (complete.has(id)) return;
    const node = byId.get(id);
    if (!node) throw new HttpError(409, 'invalid_project_reference', 'A graph reference is missing.');
    visiting.add(id);
    for (const target of relation === 'parent' ? node.parentId ? [node.parentId] : [] : node.dependsOn) visit(target);
    visiting.delete(id); complete.add(id);
  }
  for (const node of nodes) visit(node.id);
}

export function applyGraphChange(previous: ProjectNode[], change: ProjectChange): { nodes: ProjectNode[]; changedNodeId: string } {
  const nodes = structuredClone(previous);
  let changedNodeId: string;
  if (change.kind === 'add-node') {
    if (nodes.length >= MAX_PROJECT_NODES) throw new HttpError(409, 'project_limit', 'The project node limit is reached.');
    if (change.parent) referencedNode(nodes, change.parent, 'parent');
    changedNodeId = randomUUID();
    nodes.push({ id: changedNodeId, title: change.title, version: 1, taskId: change.taskId, parentId: change.parent?.nodeId ?? null, dependsOn: [] });
  } else {
    const node = referencedNode(nodes, { nodeId: change.nodeId, expectedVersion: change.expectedNodeVersion }, 'node');
    changedNodeId = node.id;
    switch (change.kind) {
      case 'bind-task':
        if (node.taskId !== null) throw new HttpError(409, 'node_already_bound', 'This node is already bound to an execution task.');
        node.taskId = change.taskId; increaseVersion(node); break;
      case 'update-node': node.title = change.title; increaseVersion(node); break;
      case 'reparent-node':
        if (change.parent) referencedNode(nodes, change.parent, 'parent');
        node.parentId = change.parent?.nodeId ?? null; increaseVersion(node); break;
      case 'set-dependencies': {
        const dependencies = change.dependencies.map(reference => referencedNode(nodes, reference, 'dependency').id);
        if (new Set(dependencies).size !== dependencies.length) throw new HttpError(409, 'duplicate_dependency', 'Each dependency must be unique.');
        node.dependsOn = dependencies.sort(); increaseVersion(node); break;
      }
      case 'remove-node':
        if (nodes.some(candidate => candidate.parentId === node.id || candidate.dependsOn.includes(node.id))) throw new HttpError(409, 'node_referenced', 'Remove child and dependency references explicitly before deleting this node.');
        nodes.splice(nodes.indexOf(node), 1); break;
      default: throw new HttpError(400, 'unsupported_project_change', 'This project command is not available.');
    }
  }
  if (nodes.reduce((count, node) => count + node.dependsOn.length, 0) > MAX_PROJECT_EDGES) throw new HttpError(409, 'project_limit', 'The project dependency limit is reached.');
  assertAcyclic(nodes, 'parent'); assertAcyclic(nodes, 'dependency');
  return { nodes, changedNodeId };
}
