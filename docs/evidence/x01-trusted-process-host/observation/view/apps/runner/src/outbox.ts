import { ActivityBodySpool, BodyStorageError } from './native-activity-body/spool.js';
import { bodyBatches } from './native-activity-body/plan.js';
import type { NativeActivityBodyInput } from '../../../packages/contracts/src/native-activity-body.js';
import { FinalProposalJournal, type FinalizationTransport } from './active-steering/proposal.js';
import { steeringFinalizationSchema } from '../../../packages/contracts/src/runner.js';
import type { ActiveSteeringPort, SteeringFinalizationResult } from '../../../packages/contracts/src/active-steering.js';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { FlowApiError, FlowClient } from '@flow/client';
import { eventBatchSchema, MAX_BATCH_BYTES, type EventBatch, type Ownership, type RunnerEvent, type RunnerEventData } from '@flow/contracts';

type Report = (batch: EventBatch) => Promise<void>;

export class EventStorageError extends Error {
  constructor() { super('Runner event storage is unavailable or corrupt; pending records were retained.'); }
}

export class EventOutbox {
  private events: RunnerEvent[] = [];
  private sequence = 0;
  private tail: Promise<void> = Promise.resolve();
  private failure: unknown;
  private readonly file: string;
  private readonly finalJournal: FinalProposalJournal;
  private barrier: Promise<void> | undefined;
  private bodyTransfer: Promise<void> | undefined;
  private readonly bodies: ActivityBodySpool;

  constructor(directory: string, private ownership: Ownership, private report: Report, initialSequence = 0) {
    if (!Number.isSafeInteger(initialSequence) || initialSequence < 0) throw new Error('Initial event sequence must be a nonnegative safe integer.');
    this.sequence = initialSequence;
    this.file = join(directory, 'pending-events.json');
    this.finalJournal = new FinalProposalJournal(directory);
    this.bodies = new ActivityBodySpool(directory);
  }

  emit(data: RunnerEventData): Promise<void> { return this.emitBatch([data]); }

  /** Capture a bounded, fixed terminal prefix before any HTTP; the existing tail remains its only sender. */
  emitBatch(data: readonly RunnerEventData[]): Promise<void> {
    const captured = eventBatchSchema.parse({ ...this.ownership,
      events: data.map(value => ({ ...value, id: randomUUID(), sequence: 1 })) }).events;
    return this.enqueue(captured);
  }

  private enqueue(captured: readonly RunnerEvent[]): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.barrier) return this.barrier.then(() => this.enqueue(captured));
    const events = captured.map((event, index) => ({ ...event, sequence: this.sequence + index + 1 }));
    const batch = eventBatchSchema.parse({ ...this.ownership, events: [...this.events, ...events] });
    this.events = batch.events;
    this.sequence += captured.length;
    const next = this.tail.then(async () => {
      if (this.events.length === 0) return;
      const sending = { ...this.ownership, events: [...this.events] };
      try {
        if (this.failure) throw this.failure;
        await persist(this.file, sending);
        await this.report(sending);
        this.events = this.events.filter(event => event.sequence > sending.events.at(-1)!.sequence);
        if (this.events.length) await persist(this.file, { ...this.ownership, events: this.events });
        else await unlink(this.file);
      } catch (error) { this.failure = error; throw error; }
    });
    this.tail = next.catch(() => undefined);
    return next;
  }

  /** One full material is durable before its first envelope, with the same
   * ordering barrier as normal events and finalization. No second sender loop. */
  publishActivityBody(input: NativeActivityBodyInput): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.barrier) return this.barrier.then(() => this.publishActivityBody(input));
    let release!: () => void;
    this.barrier = new Promise<void>(resolve => { release = resolve; });
    const next = this.tail.then(async () => {
      if (this.failure) throw this.failure;
      try {
        const job = await this.bodies.stage(input, this.ownership, this.sequence + 1);
        this.sequence = Math.max(this.sequence, job.firstSequence + job.eventIds.length - 1);
        if (await this.bodies.acknowledged(job)) return;
        const content = await this.bodies.content(job);
        for (const batch of bodyBatches(job, content)) {
          await persist(this.file, batch);
          await this.report(batch);
          await unlink(this.file);
        }
        await this.bodies.acknowledge(job);
      } catch (error) {
        this.failure = error instanceof BodyStorageError ? new EventStorageError() : error;
        throw this.failure;
      }
    }).finally(() => { this.barrier = undefined; this.bodyTransfer = undefined; release(); });
    this.bodyTransfer = next;
    this.tail = next.catch(() => undefined);
    return next;
  }

  async finalize(input: Parameters<ActiveSteeringPort['finalize']>[0], transport: FinalizationTransport): Promise<SteeringFinalizationResult> {
    if (this.bodyTransfer) await this.bodyTransfer;
    if (this.barrier || this.failure) throw this.failure ?? new Error('Another final proposal is in progress.');
    let release!: () => void, reject!: (error: unknown) => void;
    this.barrier = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
    void this.barrier.catch(() => undefined);
    try {
      await this.tail;
      if (this.failure) throw this.failure;
      const proposal = steeringFinalizationSchema.parse({ ...this.ownership, ...input, proposalId: randomUUID(), afterSequence: this.sequence,
        events: input.events.map((event, index) => ({ ...event, id: randomUUID(), sequence: this.sequence + index + 1 })) });
      const result = await this.finalJournal.commit(proposal, transport);
      if (result.state === 'committed') this.sequence = result.lastSequence;
      release(); return result;
    } catch (error) { this.failure = error; reject(error); throw error; }
    finally { this.barrier = undefined; }
  }

  async settle() { await this.tail; }
}

async function persist(file: string, batch: EventBatch) {
  try {
    const temporary = await open(`${file}.tmp`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NONBLOCK | constants.O_NOFOLLOW, 0o600);
    try {
      if (!(await temporary.stat()).isFile()) throw new Error('Event journal temporary must be regular.');
      await temporary.writeFile(JSON.stringify(batch)); await temporary.sync();
    } finally { await temporary.close(); }
    await rename(`${file}.tmp`, file);
    const directory = await open(dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } catch { throw new EventStorageError(); }
}

export async function reportBatch(client: FlowClient, batch: EventBatch, signal: AbortSignal) {
  const acknowledgement = await client.report(batch, signal);
  if (!Number.isSafeInteger(acknowledgement.lastSequence)
      || acknowledgement.lastSequence < batch.events.at(-1)!.sequence
      || !Number.isSafeInteger(acknowledgement.accepted)
      || acknowledgement.accepted < 0 || acknowledgement.accepted > batch.events.length) {
    throw new Error('The center returned an invalid event acknowledgement.');
  }
}

export async function replayPending(directory: string, report: Report, retained: (attemptId: string) => void) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const attemptDirectory = join(directory, entry.name);
    const file = join(attemptDirectory, 'pending-events.json');
    const uncertain = join(attemptDirectory, 'uncertain-events.json');
    let batch: EventBatch | undefined;
    try {
      if ((await stat(file)).size > MAX_BATCH_BYTES) throw new Error('Saved events exceed the buffer limit.');
      batch = eventBatchSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new EventStorageError();
    }
    if (batch) {
      try { await report(batch); await unlink(file); }
      catch (error) {
        if (!(error instanceof FlowApiError && [401, 403, 409].includes(error.status))) throw error;
        await rename(file, uncertain); retained(batch.attemptId); continue;
      }
    }
    try {
      const spool = new ActivityBodySpool(attemptDirectory);
      const jobs = await spool.jobs();
      // An already retained rejection never silently authorizes another body send.
      if (jobs.length && await stat(uncertain).then(() => true, error => {
        if (error.code === 'ENOENT') return false;
        throw new EventStorageError();
      })) { retained(jobs[0]!.ownership.attemptId); continue; }
      for (const job of jobs) {
        if (await spool.acknowledged(job)) continue;
        const content = await spool.content(job);
        try {
          for (const replay of bodyBatches(job, content)) {
            await persist(file, replay); await report(replay); await unlink(file);
          }
          await spool.acknowledge(job);
        } catch (error) {
          if (!(error instanceof FlowApiError && [401, 403, 409].includes(error.status))) throw error;
          await rename(file, uncertain); retained(job.ownership.attemptId); break;
        }
      }
    } catch (error) { throw error instanceof BodyStorageError ? new EventStorageError() : error; }
  }
}
