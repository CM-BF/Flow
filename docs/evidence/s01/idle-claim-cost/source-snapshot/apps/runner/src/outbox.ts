import { FinalProposalJournal, type FinalizationTransport } from './active-steering/proposal.js';
import { steeringFinalizationSchema } from '../../../packages/contracts/src/runner.js';
import type { ActiveSteeringPort, SteeringFinalizationResult } from '../../../packages/contracts/src/active-steering.js';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FlowApiError, FlowClient } from '@flow/client';
import { eventBatchSchema, MAX_BATCH_BYTES, runnerEventSchema, type EventBatch, type Ownership, type RunnerEvent, type RunnerEventData } from '@flow/contracts';

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

  constructor(directory: string, private ownership: Ownership, private report: Report, initialSequence = 0) {
    if (!Number.isSafeInteger(initialSequence) || initialSequence < 0) throw new Error('Initial event sequence must be a nonnegative safe integer.');
    this.sequence = initialSequence;
    this.file = join(directory, 'pending-events.json');
    this.finalJournal = new FinalProposalJournal(directory);
  }

  emit(data: RunnerEventData): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.barrier) return this.barrier.then(() => this.emit(data));
    const event = runnerEventSchema.parse({ ...data, id: randomUUID(), sequence: this.sequence + 1 });
    const batch = eventBatchSchema.parse({ ...this.ownership, events: [...this.events, event] });
    this.events = batch.events;
    this.sequence += 1;
    const next = this.tail.then(async () => {
      if (this.events.length === 0) return;
      const sending = { ...this.ownership, events: [...this.events] };
      await persist(this.file, sending);
      if (this.failure) throw this.failure;
      try {
        await this.report(sending);
        this.events = this.events.filter(event => event.sequence > sending.events.at(-1)!.sequence);
        if (this.events.length) await persist(this.file, { ...this.ownership, events: this.events });
        else await unlink(this.file);
      } catch (error) { this.failure = error; throw error; }
    });
    this.tail = next.catch(() => undefined);
    return next;
  }

  async finalize(input: Parameters<ActiveSteeringPort['finalize']>[0], transport: FinalizationTransport): Promise<SteeringFinalizationResult> {
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
    await writeFile(`${file}.tmp`, JSON.stringify(batch), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
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
    const file = join(directory, entry.name, 'pending-events.json');
    let batch: EventBatch;
    try {
      if ((await stat(file)).size > MAX_BATCH_BYTES) throw new Error('Saved events exceed the buffer limit.');
      batch = eventBatchSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new EventStorageError();
    }
    try {
      await report(batch);
      await unlink(file);
    } catch (error) {
      if (!(error instanceof FlowApiError && [401, 403, 409].includes(error.status))) throw error;
      await rename(file, join(directory, entry.name, 'uncertain-events.json'));
      retained(batch.attemptId);
    }
  }
}
