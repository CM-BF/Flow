import { z } from 'zod';
import type { PackageArtifact } from './package-artifacts.js';

export const PACKAGE_FETCH_LIMITS = { attempts: 3, pageSize: 40, bodyBytes: 4096 } as const;
export const packageFetchRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive().max(2_147_483_647),
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]{86}==$/),
  registryRef: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
});
export const packageFetchCommandSchema = z.strictObject({
  action: z.enum(['retry', 'reconcile']),
  reason: z.string().trim().min(1).max(512),
});
export type PackageFetchRequest = z.infer<typeof packageFetchRequestSchema>;
export type PackageFetchCommand = z.infer<typeof packageFetchCommandSchema>;
export type PackageFetchStatus = 'queued' | 'running' | 'recovering' | 'interrupted' | 'failed' | 'succeeded';
export interface PackageFetchAttempt {
  id: string; ordinal: number; artifactId: string; status: PackageFetchStatus;
  error: string | null; createdAt: string; updatedAt: string;
}
export interface PackageFetchOperation {
  id: string; installationId: string; versionId: string; admittedRevision: number;
  packageName: string; packageVersion: string; expectedSha256: string; integrity: string;
  storeId: string; registryRef: string; status: PackageFetchStatus;
  currentAttemptId: string; attempts: PackageFetchAttempt[];
  /** Verified compressed bytes only; never an installed/enabled/trusted claim. */
  artifact: PackageArtifact | null; createdAt: string; updatedAt: string;
}
export interface PackageFetchAccepted { operationId: string; attemptId: string; replayed: boolean }
export interface PackageFetchAudit {
  cursor: number; operationId: string; attemptId: string;
  kind: 'admitted' | 'retry' | 'reconcile' | 'running' | 'succeeded' | 'failed' | 'interrupted';
  actor: { kind: 'owner' } | { kind: 'center'; storeId: string; workerId: string };
  reason: string | null; error: string | null; createdAt: string;
}
export interface PackageFetchHistory { events: PackageFetchAudit[]; nextCursor: string | null }
export type PackageFetchSummary = Omit<PackageFetchOperation, 'attempts' | 'artifact'>;
export interface PackageFetchList { operations: PackageFetchSummary[]; nextCursor: string | null }
