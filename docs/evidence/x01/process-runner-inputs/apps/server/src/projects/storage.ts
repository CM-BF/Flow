import type { Pool, PoolClient } from 'pg';
import type { ProjectNode, ProjectSnapshot, ProjectView, WorkspaceList, ProjectList, GraphRunActor } from '../../../../packages/contracts/src/projects.js';
import type { TaskSummary } from '@flow/contracts';
import { HttpError, transaction } from '../database.js';

export interface ProjectRecord {
  id: string; workspace_id: string; title: string; revision: number; created_at: Date; updated_at: Date;
}
interface RevisionRecord { revision: number; reason: string; actor: string; nodes: ProjectNode[]; created_at: Date }
export function projectView(row: ProjectRecord): ProjectView {
  return { id: row.id, workspaceId: row.workspace_id, title: row.title, revision: row.revision, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function loadProject(client: PoolClient, id: string, lock = false): Promise<ProjectRecord> {
  const row = (await client.query<ProjectRecord>(`SELECT id,workspace_id,title,revision,created_at,updated_at FROM flow.projects WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'project_not_found', 'Project not found.');
  return row;
}
export async function readProject(client: PoolClient, id: string, revision?: number): Promise<ProjectSnapshot> {
  const project = await loadProject(client, id);
  const graph = (await client.query<RevisionRecord>('SELECT revision,reason,actor,nodes,created_at FROM flow.project_revisions WHERE project_id=$1 AND revision=$2', [id, revision ?? project.revision])).rows[0];
  if (!graph) throw new HttpError(404, 'project_revision_not_found', 'Project revision not found.');
  const ids = graph.nodes.flatMap(node => node.taskId ? [node.taskId] : []);
  const rows = ids.length ? (await client.query<{ id: string; title: string; harness: TaskSummary['harness']; status: TaskSummary['status']; verification_status: TaskSummary['verificationStatus']; created_at: Date; updated_at: Date }>(
    `SELECT id,submission->>'title' AS title,submission->>'harness' AS harness,status,verification_status,created_at,updated_at FROM flow.tasks WHERE id=ANY($1) ORDER BY id`, [ids])).rows : [];
  const actor = graph.actor === 'owner' ? undefined : JSON.parse(graph.actor) as GraphRunActor;
  return {
    project: projectView(project),
    graph: { revision: graph.revision, reason: graph.reason, actor: actor ? 'goal-graph-run' : 'owner', ...(actor ? { actorSource: actor } : {}), createdAt: graph.created_at.toISOString(), nodes: graph.nodes },
    tasks: rows.map(row => ({ id: row.id, title: row.title, harness: row.harness, status: row.status, verificationStatus: row.verification_status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() })),
  };
}
export async function projectSnapshot(pool: Pool, id: string, revision?: number): Promise<ProjectSnapshot> {
  return transaction(pool, client => readProject(client, id, revision), true);
}
export async function workspaceList(pool: Pool): Promise<WorkspaceList> {
  const result = await pool.query<{ id: string; title: string; created_at: Date }>('SELECT id,title,created_at FROM flow.workspaces ORDER BY id LIMIT 100');
  return { workspaces: result.rows.map(row => ({ id: row.id, title: row.title, createdAt: row.created_at.toISOString() })) };
}

export async function projectList(pool: Pool, workspaceId: string, limit: number, after?: string): Promise<ProjectList> {
  return transaction(pool, async client => {
    if (!(await client.query('SELECT 1 FROM flow.workspaces WHERE id=$1', [workspaceId])).rowCount) throw new HttpError(404, 'workspace_not_found', 'Workspace not found.');
    const result = await client.query<ProjectRecord>('SELECT id,workspace_id,title,revision,created_at,updated_at FROM flow.projects WHERE workspace_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3', [workspaceId, after ?? null, limit + 1]);
    const projects = result.rows.slice(0, limit).map(projectView);
    return { projects, nextCursor: result.rows.length > limit ? projects.at(-1)!.id : null };
  }, true);
}
