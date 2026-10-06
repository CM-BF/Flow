import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ProjectCreation, ProjectCommand, ProjectMutationResult, ProjectNode, ProjectActor } from '../../../../packages/contracts/src/projects.js';
import { command } from '../tasks.js';
import { HttpError } from '../database.js';
import { applyGraphChange } from './graph.js';
import { loadProject, readProject } from './storage.js';

export async function createProject(pool: Pool, input: ProjectCreation, key: string): Promise<ProjectMutationResult> {
  const result = await command(pool, 'project:create', key, input, async client => {
    const id = randomUUID();
    await client.query('INSERT INTO flow.projects(id,workspace_id,title,revision) VALUES($1,$2,$3,1)', [id, input.workspaceId, input.title]);
    await client.query("INSERT INTO flow.project_revisions(project_id,revision,reason,actor,nodes) VALUES($1,1,'Project created','owner','[]')", [id]);
    return { snapshot: await readProject(client, id), changedNodeId: null };
  });
  return { ...result.value, replayed: result.replayed };
}

export async function changeProject(pool: Pool, id: string, input: ProjectCommand, key: string): Promise<ProjectMutationResult> {
  const result = await command(pool, `project:change:${id}`, key, input, client => applyProjectCommand(client, id, input));
  return { ...result.value, replayed: result.replayed };
}

/** Caller owns authorization and transaction; all original G01 mutation rules remain here. */
export async function applyProjectCommand(client: PoolClient, id: string, input: ProjectCommand, actor: ProjectActor = { kind: 'owner' }): Promise<Omit<ProjectMutationResult, 'replayed'>> {
  const project = await loadProject(client, id, true);
  if (project.revision !== input.expectedRevision) throw new HttpError(409, 'stale_project_revision', 'Reload the current project revision.');
  if (project.revision === 2_147_483_647) throw new HttpError(409, 'project_revision_exhausted', 'The project revision limit is reached.');
  const current = await readProject(client, id);
  const changed = applyGraphChange(current.graph.nodes, input.change);
  await updateBindings(client, id, current.graph.nodes, changed.nodes);
  const revision = project.revision + 1;
  await client.query("INSERT INTO flow.project_revisions(project_id,revision,reason,actor,nodes) VALUES($1,$2,$3,$4,$5)", [id, revision, input.reason, actor.kind === 'owner' ? 'owner' : JSON.stringify(actor), JSON.stringify(changed.nodes)]);
  await client.query('UPDATE flow.projects SET revision=$2,updated_at=clock_timestamp() WHERE id=$1', [id, revision]);
  return { snapshot: await readProject(client, id), changedNodeId: changed.changedNodeId };
}

async function updateBindings(client: PoolClient, projectId: string, previous: ProjectNode[], nodes: ProjectNode[]): Promise<void> {
  const bound = nodes.filter((node): node is ProjectNode & { taskId: string } => node.taskId !== null);
  if (new Set(bound.map(node => node.taskId)).size !== bound.length) throw new HttpError(409, 'task_already_bound', 'A task can belong to only one current project node.');
  const added = bound.filter(node => previous.find(old => old.id === node.id)?.taskId !== node.taskId).sort((a, b) => a.taskId.localeCompare(b.taskId));
  if (added.length) {
    const existing = await client.query('SELECT id FROM flow.tasks WHERE id=ANY($1)', [added.map(node => node.taskId)]);
    if (existing.rowCount !== added.length) throw new HttpError(404, 'task_not_found', 'An execution task was not found.');
  }
  for (const old of previous.filter(node => node.taskId && !nodes.some(next => next.id === node.id))) {
    await client.query('DELETE FROM flow.project_task_bindings WHERE project_id=$1 AND node_id=$2', [projectId, old.id]);
  }
  for (const node of added) {
    try { await client.query('INSERT INTO flow.project_task_bindings(task_id,project_id,node_id) VALUES($1,$2,$3)', [node.taskId, projectId, node.id]); }
    catch (error) {
      if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'task_already_bound', 'A task can belong to only one current project node.');
      throw error;
    }
  }
}
