import type { TaskSummary } from '@flow/contracts';

/** Fixed summary projection: prompt stays in PostgreSQL; JSONB extraction can still detoast it there. */
export const TASK_SUMMARY_COLUMNS = "id,submission->>'title' AS title,submission->>'harness' AS harness,status,verification_status,created_at,updated_at";
export interface TaskSummaryRow {
  id: string; title: string; harness: TaskSummary['harness']; status: TaskSummary['status'];
  verification_status: TaskSummary['verificationStatus']; created_at: Date; updated_at: Date;
}
export function toTaskSummary(row: TaskSummaryRow): TaskSummary {
  return { id: row.id, title: row.title, harness: row.harness, status: row.status,
    verificationStatus: row.verification_status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
