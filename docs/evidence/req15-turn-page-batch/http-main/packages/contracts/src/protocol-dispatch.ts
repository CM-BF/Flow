import { z } from 'zod';
import { idSchema, type TaskStatus, type Reference } from './tasks.js';
import { ownershipSchema, type ClaimedTask } from './runner.js';

export { protocolTaskSchema, type ProtocolTask } from './protocol-task.js';
export const protocolPrepareSchema = ownershipSchema.extend({ endpointDigest: z.string().regex(/^[a-f0-9]{64}$/) });
export type ProtocolPrepare = z.infer<typeof protocolPrepareSchema>;
export const protocolCommandSchema = ownershipSchema.extend({ commandId: idSchema });
export const protocolBindSchema = protocolCommandSchema.extend({ remoteTaskId: idSchema });
export const protocolUncertainSchema = protocolCommandSchema.extend({ reason: z.enum(['send-result-unknown', 'recovered-inflight-send', 'remote-read-failed', 'unsupported-remote-result', 'local-storage-failed']) });
export type ProtocolCommand = z.infer<typeof protocolCommandSchema>;
export type ProtocolBind = z.infer<typeof protocolBindSchema>;
export type ProtocolUncertain = z.infer<typeof protocolUncertainSchema>;
export interface ProtocolIntent {
  taskId: string;
  attemptId: string;
  ownerVersion: number;
  endpointRef: string;
  endpointDigest: string;
  commandId: string;
  phase: 'prepared' | 'sending' | 'bound' | 'uncertain';
  remoteTaskId: string | null;
  cancelStarted: boolean;
  reason: ProtocolUncertain['reason'] | null;
  createdAt: string;
  updatedAt: string;
}
export interface ProtocolArtifactReceipt { artifactId: string; version: string; verified: boolean; reference: Reference }
export interface ProtocolState {
  intent: ProtocolIntent;
  taskStatus: TaskStatus;
  lastSequence: number;
  remainingLeaseMs: number;
  artifacts: ProtocolArtifactReceipt[];
}
/** Permission is returned only for the first prepared→sending transaction, never replayed. */
export interface ProtocolDispatchPermit { state: ProtocolState; maySend: boolean }
export interface ProtocolRecovery { assignment: ClaimedTask; lastSequence: number; remainingLeaseMs: number }
export interface ProtocolRecoverResponse { assignments: ProtocolRecovery[] }
