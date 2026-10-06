import { z } from 'zod';
import { idSchema, WORKSPACE_ID, type TaskSummary } from './tasks.js';

export const MAX_PROJECT_NODES = 200;
export const MAX_PROJECT_EDGES = 2_000;
export const projectVersionSchema = z.number().int().min(1).max(2_147_483_647);
const titleSchema = z.string().trim().min(1).max(180);
export const projectNodeReferenceSchema = z.strictObject({
  nodeId: idSchema,
  expectedVersion: projectVersionSchema,
});

export const projectCreationSchema = z.strictObject({
  workspaceId: z.literal(WORKSPACE_ID).default(WORKSPACE_ID),
  title: titleSchema,
});
export const projectChangeSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('add-node'),
    title: titleSchema,
    taskId: idSchema.nullable().default(null),
    parent: projectNodeReferenceSchema.nullable().default(null),
  }),
  z.strictObject({
    kind: z.literal('update-node'),
    nodeId: idSchema,
    expectedNodeVersion: projectVersionSchema,
    title: titleSchema,
  }),
  z.strictObject({
    kind: z.literal('bind-task'),
    nodeId: idSchema,
    expectedNodeVersion: projectVersionSchema,
    taskId: idSchema,
  }),
  z.strictObject({
    kind: z.literal('reparent-node'),
    nodeId: idSchema,
    expectedNodeVersion: projectVersionSchema,
    parent: projectNodeReferenceSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('set-dependencies'),
    nodeId: idSchema,
    expectedNodeVersion: projectVersionSchema,
    dependencies: z.array(projectNodeReferenceSchema).max(MAX_PROJECT_NODES - 1),
  }),
  z.strictObject({
    kind: z.literal('remove-node'),
    nodeId: idSchema,
    expectedNodeVersion: projectVersionSchema,
  }),
]);
export const projectCommandSchema = z.strictObject({
  expectedRevision: projectVersionSchema,
  reason: z.string().trim().min(1).max(4_000),
  change: projectChangeSchema,
});
export type ProjectCreation = z.infer<typeof projectCreationSchema>;
export type ProjectCommand = z.infer<typeof projectCommandSchema>;
export type ProjectChange = ProjectCommand['change'];

export interface WorkspaceView { id: string; title: string; createdAt: string }
export interface WorkspaceList { workspaces: WorkspaceView[] }
export interface ProjectView {
  id: string;
  workspaceId: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectList { projects: ProjectView[]; nextCursor: string | null }
export interface ProjectNode {
  id: string;
  title: string;
  version: number;
  taskId: string | null;
  parentId: string | null;
  /** Planning edges only in this slice: these do not gate existing task dispatch. */
  dependsOn: string[];
}
export interface GraphRunActor { kind: 'goal-graph-run'; runId: string; runnerId: string; taskId: string; attemptId: string; ownerVersion: number }
export type ProjectActor = { kind: 'owner' } | GraphRunActor;
export interface ProjectRevision {
  revision: number;
  reason: string;
  actor: 'owner' | 'goal-graph-run';
  actorSource?: GraphRunActor;
  createdAt: string;
  nodes: ProjectNode[];
}
export interface ProjectSnapshot {
  project: ProjectView;
  graph: ProjectRevision;
  /** Live authoritative task summaries, even when reading an older graph revision. */
  tasks: TaskSummary[];
}
export interface ProjectMutationResult {
  snapshot: ProjectSnapshot;
  changedNodeId: string | null;
  replayed: boolean;
}
