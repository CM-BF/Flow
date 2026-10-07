import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Ownership } from '../../../../packages/contracts/src/runner.js';
import { NATIVE_ACTIVITY_BODY_LIMITS as limits, type NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
import { bodyDigest, bodyJobSchema, planBody, type BodyJob } from './plan.js';

const MAX_MANIFEST_BYTES = 524_288;
const identity = (value: { dev: number; ino: number }) => `${value.dev}:${value.ino}`;
export class BodyStorageError extends Error {
  constructor() { super('Native activity material storage is unavailable or corrupt; records retained.'); }
}
async function directory(path: string) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.()) throw new BodyStorageError();
  return info;
}
async function syncDirectory(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function writeNew(path: string, content: Uint8Array) {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
}
async function boundedFile(path: string, maxBytes: number): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.uid !== process.getuid?.() || before.size > maxBytes) throw new BodyStorageError();
    const bytes = Buffer.alloc(Math.min(before.size, maxBytes) + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, length);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    const after = await handle.stat();
    if (length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
        || identity(before) !== identity(after)) throw new BodyStorageError();
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}
export class ActivityBodySpool {
  private readonly root: string;
  constructor(private readonly attemptDirectory: string) { this.root = join(attemptDirectory, 'activity-bodies'); }

  async jobs(): Promise<BodyJob[]> {
    // An absent root before enumeration means no body was staged. Once seen,
    // disappearance anywhere is corruption/unknown rather than an empty spool.
    let rootIdentity: string;
    try { rootIdentity = identity(await directory(this.root)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new BodyStorageError();
    }
    try {
      const entries = await readdir(this.root, { withFileTypes: true });
      if (entries.length > limits.bodies) throw new BodyStorageError();
      const jobs: BodyJob[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) throw new BodyStorageError();
        await directory(join(this.root, entry.name));
        const job = bodyJobSchema.parse(JSON.parse((await boundedFile(join(this.root, entry.name, 'manifest.json'), MAX_MANIFEST_BYTES)).toString('utf8')));
        if (job.activity.activityId !== entry.name) throw new BodyStorageError();
        jobs.push(job);
      }
      jobs.sort((a, b) => a.firstSequence - b.firstSequence);
      if (identity(await directory(this.root)) !== rootIdentity
          || jobs.reduce((sum, item) => sum + item.bytes, 0) > limits.attemptBytes
          || jobs.some((item, index) => index > 0 && (item.firstSequence <= jobs[index - 1]!.firstSequence + jobs[index - 1]!.eventIds.length - 1
            || JSON.stringify(item.ownership) !== JSON.stringify(jobs[0]!.ownership)))) throw new BodyStorageError();
      return jobs;
    } catch { throw new BodyStorageError(); }
  }

  async stage(input: NativeActivityBodyInput, ownership: Ownership, firstSequence: number): Promise<BodyJob> {
    if (input.content.byteLength > limits.bodyBytes) throw new BodyStorageError();
    const content = Buffer.from(input.content);
    const job = planBody({ ...input, content }, ownership, firstSequence);
    try {
      await directory(this.attemptDirectory);
      await mkdir(this.root, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      await syncDirectory(this.attemptDirectory);
      const rootIdentity = identity(await directory(this.root));
      const previous = await this.jobs();
      const prior = previous.find(item => item.activity.activityId === job.activity.activityId);
      if (prior) {
        if (JSON.stringify(prior.ownership) !== JSON.stringify(ownership) || JSON.stringify(prior.activity) !== JSON.stringify(job.activity)) throw new BodyStorageError();
        return prior; // Same source re-emission keeps its original frozen envelopes.
      }
      if (previous.some(item => JSON.stringify(item.ownership) !== JSON.stringify(ownership))
          || previous.some(item => firstSequence <= item.firstSequence + item.eventIds.length - 1)
          || previous.length >= limits.bodies || previous.reduce((sum, item) => sum + item.bytes, 0) + job.bytes > limits.attemptBytes) throw new BodyStorageError();
      const staging = join(this.root, `${job.activity.activityId}.${randomUUID()}.tmp`);
      await mkdir(staging, { mode: 0o700 });
      const manifest = Buffer.from(JSON.stringify(job));
      if (manifest.length > MAX_MANIFEST_BYTES) throw new BodyStorageError();
      await writeNew(join(staging, 'content.bin'), content);
      await writeNew(join(staging, 'manifest.json'), manifest);
      await syncDirectory(staging);
      if (identity(await directory(this.root)) !== rootIdentity) throw new BodyStorageError();
      await rename(staging, join(this.root, job.activity.activityId));
      await syncDirectory(this.root);
      return job;
    } catch { throw new BodyStorageError(); }
  }

  async content(job: BodyJob): Promise<Buffer> {
    try {
      await directory(this.root); await directory(join(this.root, job.activity.activityId));
      const content = await boundedFile(join(this.root, job.activity.activityId, 'content.bin'), job.bytes);
      if (content.length !== job.bytes || bodyDigest(content) !== job.sha256) throw new BodyStorageError();
      return content;
    } catch { throw new BodyStorageError(); }
  }

  async acknowledged(job: BodyJob): Promise<boolean> {
    try {
      const receipt = JSON.parse((await boundedFile(join(this.root, job.activity.activityId, 'ack.json'), 1024)).toString('utf8'));
      if (JSON.stringify(receipt) !== JSON.stringify(this.receipt(job))) throw new BodyStorageError();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw new BodyStorageError();
    }
  }

  async acknowledge(job: BodyJob): Promise<void> {
    try {
      const path = join(this.root, job.activity.activityId);
      await directory(path);
      await writeNew(join(path, 'ack.json'), Buffer.from(JSON.stringify(this.receipt(job))));
      await syncDirectory(path);
      // Receipt remains quota/idempotency evidence after source bytes can be released.
      await unlink(join(path, 'content.bin'));
      await syncDirectory(path);
    } catch { throw new BodyStorageError(); }
  }
  private receipt(job: BodyJob) {
    return { activityId: job.activity.activityId, ownership: job.ownership,
      sha256: job.sha256, lastSequence: job.firstSequence + job.eventIds.length - 1 };
  }
}
