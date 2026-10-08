import type { DecisionRequest, Reference, TaskStatus, TaskSummary, TimelineEntry } from './tasks.js';
import { z } from 'zod';

export const taskIndexQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(1024).optional(),
  statuses: z.array(z.enum(['queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'uncertain'])).min(1).max(8).optional(),
  contextId: z.string().min(1).max(128).optional(),
  updatedAfter: z.iso.datetime().optional(),
});

export interface WorkspaceTask extends TaskSummary {
  ownerVersion: number;
  pendingDecision: DecisionRequest | null;
}

export interface WorkspaceEntry {
  id: string;
  cursor: number;
  task: Reference;
  entry: TimelineEntry;
}

export interface WorkspacePage {
  workspaceId: string;
  entries: WorkspaceEntry[];
  nextCursor: number;
  previousCursor: number;
  watermark: number;
  hasMore: boolean;
  hasEarlier: boolean;
  projectionPending: boolean;
  tasks: WorkspaceTask[];
  tasksTruncated: boolean;
  attention: WorkspaceTask[];
  attentionTruncated: boolean;
}

export interface WorkspaceQuery {
  after?: number;
  before?: number;
  limit?: number;
}

export interface TaskIndexQuery {
  limit?: number;
  cursor?: string;
  statuses?: TaskStatus[];
  contextId?: string;
  updatedAfter?: string;
}

export interface TaskIndexPage {
  tasks: TaskSummary[];
  nextCursor: string | null;
  totalSize: number;
}
