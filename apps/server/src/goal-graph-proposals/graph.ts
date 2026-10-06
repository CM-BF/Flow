import type { GoalGraphProposalInput } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import type { ProjectChange, ProjectNode } from '../../../../packages/contracts/src/projects.js';
import { HttpError } from '../database.js';
import { applyGraphChange } from '../projects/graph.js';

type Change = (change: ProjectChange) => Promise<{ nodes: ProjectNode[]; changedNodeId: string }>;
/** The same bounded recipe validates a proposal and applies it via the G01 transaction seam. */
export async function assemble(input: GoalGraphProposalInput, initialNodes: ProjectNode[], change: Change) {
  let nodes = initialNodes;
  const ids = new Map<string, string>();
  for (const addition of input.additions) {
    const added = await change({ kind: 'add-node', title: addition.title, taskId: null, parent: null });
    ids.set(addition.key, added.changedNodeId); nodes = added.nodes;
  }
  for (const addition of input.additions) {
    if (!addition.dependencies.length) continue;
    const nodeId = ids.get(addition.key)!;
    const dependencies = addition.dependencies.map(reference => {
      if (reference.kind === 'existing') return { nodeId: reference.nodeId, expectedVersion: reference.expectedVersion };
      const id = ids.get(reference.key);
      if (!id) throw new HttpError(409, 'proposal_reference', 'A proposed dependency key does not exist.');
      return { nodeId: id, expectedVersion: nodes.find(node => node.id === id)!.version };
    });
    const changed = await change({ kind: 'set-dependencies', nodeId, expectedNodeVersion: nodes.find(node => node.id === nodeId)!.version, dependencies });
    nodes = changed.nodes;
  }
  return { nodes, nodeIds: Object.fromEntries(ids) };
}
export async function validateGraph(input: GoalGraphProposalInput, initialNodes: ProjectNode[]) {
  let nodes = initialNodes;
  await assemble(input, nodes, async change => {
    const result = applyGraphChange(nodes, change); nodes = result.nodes; return result;
  });
}
