import { z } from 'zod';
import { idSchema } from './tasks.js';

/** Maintenance controls admission only. Existing work and external effects are not cancelled. */
export const runnerMaintenanceCommandSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  operationId: idSchema,
  reason: z.string().trim().min(1).max(1000),
});
export type RunnerMaintenanceCommand = z.infer<typeof runnerMaintenanceCommandSchema>;
export type RunnerMaintenanceState = 'accepting' | 'draining' | 'maintenance';
export interface RunnerMaintenanceView {
  runnerId: string;
  version: number;
  state: RunnerMaintenanceState;
  operationId: string | null;
  activeAttempts: number;
  uncertainAttempts: number;
  updatedAt: string | null;
  /** An observed count is never a permit to stop a process. */
  stopPermitted: false;
}
export interface RunnerMaintenanceAudit {
  id: string;
  runnerId: string;
  requestId: string;
  action: 'drain' | 'hold' | 'resume';
  source: 'owner-http' | 'trusted-host';
  operationId: string;
  reason: string;
  before: { state: RunnerMaintenanceState; version: number };
  after: { state: RunnerMaintenanceState; version: number };
  createdAt: string;
}
export interface RunnerMaintenanceResult {
  /** State when this command committed; replay must not be treated as the current state. */
  state: { runnerId: string; state: RunnerMaintenanceState; version: number; operationId: string | null };
  audit: RunnerMaintenanceAudit;
  replayed: boolean;
}
export interface RunnerMaintenanceHistory {
  audits: RunnerMaintenanceAudit[];
  nextCursor: string | null;
}
