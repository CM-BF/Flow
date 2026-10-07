import fs, { type FileHandle } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { ProcessIdentity } from './process-protocol.js';

type Identity = { dev: number; ino: number };
export interface ProcessReservation { slot: string; scratch: string; identity: ProcessIdentity; scratchIdentity: Identity; recordIdentity: Identity; record: Record<string, unknown> }
const uid = () => process.getuid!();
const isSame = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;
function fail(): never { throw new Error('PROCESS_RESOURCE_UNKNOWN'); }
async function directory(path: string): Promise<FileHandle> {
  const fd = await fs.open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { const s = await fd.stat(); if (!s.isDirectory() || s.uid !== uid() || (s.mode & 0o777) !== 0o700) fail(); return fd; }
  catch (error) { await fd.close(); throw error; }
}
async function inspectFile(path: string, expected?: Identity): Promise<{ bytes: Buffer; identity: Identity }> {
  const before = await fs.lstat(path); const fd = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await fd.stat();
    if (!s.isFile() || s.uid !== uid() || (s.mode & 0o777) !== 0o600 || s.nlink !== 1 || !isSame(s, before) || expected && !isSame(s, expected) || s.size > 4096) fail();
    const data = Buffer.alloc(4097); const { bytesRead } = await fd.read(data, 0, data.length, 0); if (bytesRead > 4096) fail();
    if (!isSame(s, await fs.lstat(path))) fail(); return { bytes: data.subarray(0, bytesRead), identity: s };
  } finally { await fd.close(); }
}
async function createFile(path: string, value: unknown): Promise<Identity> {
  const bytes = Buffer.from(JSON.stringify(value)); if (bytes.length > 4096) fail();
  const fd = await fs.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await fd.writeFile(bytes); await fd.sync(); const s = await fd.stat(); if (!s.isFile() || s.nlink !== 1 || s.uid !== uid() || (s.mode & 0o777) !== 0o600) fail(); return s; }
  finally { await fd.close(); }
}

/** Bounded resource facts only. No business recovery, PID reclamation, or recursive cleanup. */
export class ProcessResources {
  private slots = new Set<string>(); private held = false; private queued = 0; private queue = Promise.resolve();
  private constructor(readonly root: string, private readonly folders: Map<string, FileHandle>, private readonly marker: Identity) {}
  static async open(path: string): Promise<ProcessResources> {
    if (resolve(path) !== path || process.platform !== 'darwin' || process.arch !== 'arm64' || process.version !== 'v24.20.0') fail();
    const parent = await fs.realpath(join(path, '..')); if (join(parent, path.split('/').at(-1)!) !== path) fail();
    const folders = new Map<string, FileHandle>();
    try {
      for (const p of [path, join(path, 'receipts'), join(path, 'scratch')]) {
        try { await fs.mkdir(p, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        folders.set(p, await directory(p));
      }
      let count = 0, bytes = 0; const entries = await fs.opendir(join(path, 'receipts'));
      for await (const entry of entries) {
        if (++count > 65 || !/^(?:owner\.json|slot-\d{2}\.(?:json|next))$/.test(entry.name)) fail();
        const record = await inspectFile(join(path, 'receipts', entry.name)); bytes += record.bytes.length; if (bytes > 266240) fail();
        // Existing facts are deliberately not adopted or converted to business recovery.
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(record.bytes));
      }
      if (count) fail();
      const scratch = await fs.opendir(join(path, 'scratch')); let nonempty = false;
      try { nonempty = (await scratch.read()) !== null; } finally { await scratch.close(); }
      if (nonempty) fail();
      const marker = await createFile(join(path, 'receipts/owner.json'), { protocol: 'flow.plugin-process-resource.v1', parentPid: process.pid, nonce: randomBytes(16).toString('hex') });
      await folders.get(join(path, 'receipts'))!.sync(); return new ProcessResources(path, folders, marker);
    } catch (error) { await Promise.allSettled([...folders.values()].map(f => f.close())); throw error; }
  }
  private async checkRoots(): Promise<void> {
    for (const [path, fd] of this.folders) { const a = await fd.stat(), b = await fs.lstat(path); if (!b.isDirectory() || b.isSymbolicLink() || b.uid !== uid() || (b.mode & 0o777) !== 0o700 || !isSame(a, b)) fail(); }
  }
  async reserve(identity: ProcessIdentity): Promise<ProcessReservation> {
    if (this.held || this.queued + this.slots.size >= 32) fail(); this.queued++;
    const before = this.queue; let release!: () => void; this.queue = new Promise<void>(r => { release = r; }); await before;
    try {
      if (this.held) fail(); await this.checkRoots();
      const slot = Array.from({ length: 32 }, (_, n) => String(n).padStart(2, '0')).find(s => !this.slots.has(s)); if (!slot) fail();
      const record = { protocol: 'flow.plugin-process-resource.v1', identity, state: 'reserved', parentPid: process.pid, slot };
      const recordIdentity = await createFile(join(this.root, `receipts/slot-${slot}.json`), record); this.slots.add(slot);
      await this.folders.get(join(this.root, 'receipts'))!.sync();
      const scratch = join(this.root, 'scratch', slot); await fs.mkdir(scratch, { mode: 0o700 }); const fd = await directory(scratch);
      let scratchIdentity: Identity; try { scratchIdentity = await fd.stat(); } finally { await fd.close(); }
      await this.checkRoots(); return { slot, scratch, identity, scratchIdentity, recordIdentity, record };
    } catch (error) { this.held = true; throw error; } finally { this.queued--; release(); }
  }
  async update(item: ProcessReservation, fields: Record<string, unknown>): Promise<void> {
    try {
      await this.checkRoots(); const file = join(this.root, `receipts/slot-${item.slot}.json`), next = join(this.root, `receipts/slot-${item.slot}.next`);
      await inspectFile(file, item.recordIdentity); const record = { ...item.record, ...fields };
      const nextIdentity = await createFile(next, record); await inspectFile(next, nextIdentity); await inspectFile(file, item.recordIdentity);
      await fs.rename(next, file); await this.folders.get(join(this.root, 'receipts'))!.sync();
      item.record = record; item.recordIdentity = nextIdentity; await this.checkRoots();
    } catch (error) { this.held = true; throw error; }
  }
  keep(): void { this.held = true; }
  async finish(item: ProcessReservation): Promise<void> {
    try {
      await this.update(item, { state: 'closed' }); const s = await fs.lstat(item.scratch);
      if (!s.isDirectory() || s.isSymbolicLink() || !isSame(s, item.scratchIdentity)) fail();
      const dir = await fs.opendir(item.scratch); let empty: boolean; try { empty = (await dir.read()) === null; } finally { await dir.close(); }
      if (!empty) fail(); await fs.rmdir(item.scratch);
      const file = join(this.root, `receipts/slot-${item.slot}.json`); await inspectFile(file, item.recordIdentity); await fs.unlink(file);
      await this.folders.get(join(this.root, 'receipts'))!.sync(); this.slots.delete(item.slot); await this.checkRoots();
    } catch (error) { this.held = true; throw error; }
  }
  async close(): Promise<void> {
    try {
      if (this.slots.size || this.held || this.queued) fail(); await this.checkRoots();
      const file = join(this.root, 'receipts/owner.json'); await inspectFile(file, this.marker); await fs.unlink(file); await this.folders.get(join(this.root, 'receipts'))!.sync();
    } finally { await Promise.allSettled([...this.folders.values()].map(f => f.close())); }
  }
}
