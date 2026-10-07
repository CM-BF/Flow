import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { open, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { EventStorageError } from './outbox.js';
import { RUNNER_CLAIM_PROTOCOL, type RunnerClaimRequest } from '@flow/contracts';

const id = z.string().min(1).max(128);
const assignmentSchema = z.strictObject({ attemptId: id, taskId: id, runnerId: id, ownerVersion: z.number().int().positive() });
const legacySnapshotSchema = z.strictObject({ version: z.literal(1), inFlight: z.string().uuid().nullable(), assignments: z.array(assignmentSchema).max(16) });
const opportunitySnapshotSchema = z.strictObject({ version: z.literal(2), runnerId: id, opportunityId: z.string().uuid(), assignments: z.array(assignmentSchema).max(16) })
  .refine(value => value.assignments.every(item => item.runnerId === value.runnerId));
const snapshotSchema = z.union([legacySnapshotSchema, opportunitySnapshotSchema])
  .refine(value => new Set(value.assignments.map(item => item.attemptId)).size === value.assignments.length);
export type AdmissionAssignment = z.infer<typeof assignmentSchema>;
type Snapshot = z.infer<typeof snapshotSchema>;
const MAX_BYTES = 65536;

export class AdmissionStorageError extends EventStorageError {
  constructor(cause: unknown) {
    super();
    this.message = 'Runner admission storage is unavailable or corrupt; new claims are blocked.';
    this.cause = cause;
  }
}

/** One runtime owns this journal. It contains identifiers, never credentials or execution input. */
export class AdmissionJournal {
  private tail: Promise<void> = Promise.resolve();
  private constructor(private directory: string, private snapshot: Snapshot) {}

  static async open(directory: string): Promise<AdmissionJournal> {
    let snapshot: Snapshot = { version: 1, inFlight: null, assignments: [] };
    try {
      const file = await open(join(directory, 'admission.json'), constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      try {
        const metadata = await file.stat();
        if (!metadata.isFile() || metadata.size > MAX_BYTES) throw new Error('Admission journal must be a bounded regular file.');
        const bytes = Buffer.alloc(MAX_BYTES + 1);
        let bytesRead = 0;
        while (bytesRead < bytes.length) {
          const part = await file.read(bytes, bytesRead, bytes.length - bytesRead, bytesRead);
          if (!part.bytesRead) break;
          bytesRead += part.bytesRead;
        }
        if (bytesRead > MAX_BYTES) throw new Error('Admission journal exceeds its byte limit.');
        snapshot = snapshotSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytesRead))));
      } finally { await file.close(); }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw new AdmissionStorageError(error);
    }
    return new AdmissionJournal(directory, snapshot);
  }

  unresolved(active: ReadonlySet<string>): boolean {
    return (this.snapshot.version === 1 && this.snapshot.inFlight !== null) || this.snapshot.assignments.some(item => !active.has(item.attemptId));
  }

  /** Only a clean legacy journal may enter v2; existing v1 uncertainty never becomes a recoverable key. */
  async bindRunner(runnerId: string): Promise<boolean> {
    id.parse(runnerId);
    await this.change(snapshot => {
      if ((snapshot.version === 2 && snapshot.runnerId !== runnerId) || snapshot.assignments.some(item => item.runnerId !== runnerId)) {
        throw new AdmissionStorageError(new Error('Admission journal belongs to another authenticated runner.'));
      }
      if (snapshot.version === 2 || snapshot.inFlight !== null || snapshot.assignments.length) return snapshot;
      return { version: 2, runnerId, opportunityId: randomUUID(), assignments: [] };
    });
    return this.snapshot.version === 2;
  }

  get opportunity(): RunnerClaimRequest | null {
    const snapshot = this.snapshot;
    return snapshot.version === 2 ? { protocol: RUNNER_CLAIM_PROTOCOL, runnerId: snapshot.runnerId, requestId: snapshot.opportunityId } : null;
  }

  /** Assignment and the next key become durable together, before any adapter can start. Empty polls do not call this. */
  acceptOpportunity(expected: RunnerClaimRequest, assignment: AdmissionAssignment): Promise<void> {
    return this.change(snapshot => {
      if (snapshot.version !== 2 || expected.protocol !== RUNNER_CLAIM_PROTOCOL || snapshot.opportunityId !== expected.requestId
        || snapshot.runnerId !== expected.runnerId || assignment.runnerId !== snapshot.runnerId) {
        throw new AdmissionStorageError(new Error('Claim acknowledgement does not match the durable opportunity.'));
      }
      return snapshotSchema.parse({ ...snapshot, opportunityId: randomUUID(), assignments: [...snapshot.assignments, assignmentSchema.parse(assignment)] });
    });
  }

  begin(): Promise<void> {
    return this.change(snapshot => {
      if (snapshot.version !== 1) throw new Error('Legacy admission cannot change a v2 opportunity.');
      if (snapshot.inFlight !== null) throw new Error('Unresolved claim prevents another admission.');
      if (snapshot.assignments.length >= 16) throw new Error('Sixteen retained assignments prevent another admission.');
      return { ...snapshot, inFlight: randomUUID() };
    });
  }

  /** Only a definite response can replace the intent. Assignment and intent change in one durable rename. */
  accept(assignment: AdmissionAssignment | null): Promise<void> {
    return this.change(snapshot => {
      if (snapshot.version !== 1) throw new Error('Legacy acknowledgement cannot change a v2 opportunity.');
      if (!snapshot.inFlight) throw new Error('No claim intent exists.');
      const assignments = assignment ? [...snapshot.assignments, assignmentSchema.parse(assignment)] : snapshot.assignments;
      return snapshotSchema.parse({ ...snapshot, inFlight: null, assignments });
    });
  }

  /** Call only after a validated completion-event ACK; a final proposal receipt is insufficient. */
  complete(ownership: { attemptId: string; ownerVersion: number }): Promise<void> {
    return this.change(snapshot => ({ ...snapshot, assignments: snapshot.assignments.filter(item =>
      item.attemptId !== ownership.attemptId || item.ownerVersion !== ownership.ownerVersion) }));
  }

  private change(update: (snapshot: Snapshot) => Snapshot): Promise<void> {
    const next = this.tail.then(async () => {
      const snapshot = update(this.snapshot);
      if (snapshot === this.snapshot) return;
      try {
        const file = await open(join(this.directory, 'admission.json.tmp'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NONBLOCK | constants.O_NOFOLLOW, 0o600);
        try {
          if (!(await file.stat()).isFile()) throw new Error('Admission temporary journal must be a regular file.');
          const bytes = JSON.stringify(snapshot);
          if (Buffer.byteLength(bytes) > MAX_BYTES) throw new Error('Admission journal exceeds its byte limit.');
          await file.writeFile(bytes); await file.sync();
        } finally { await file.close(); }
        await rename(join(this.directory, 'admission.json.tmp'), join(this.directory, 'admission.json'));
        const directory = await open(this.directory, 'r');
        try { await directory.sync(); } finally { await directory.close(); }
        this.snapshot = snapshot;
      } catch (error) { throw new AdmissionStorageError(error); }
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
}
