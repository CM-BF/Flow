import { constants } from 'node:fs';
import { open, lstat, realpath, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { nativeEngineeringCheckEvidenceSchema } from '../../../../packages/contracts/src/engineering-native.js';

export const CALCULATOR_TOOL_BYTES = 2048;
const hash = z.string().regex(/^[a-f0-9]{64}$/), id = z.string().min(1).max(128);
const bindingSchema = z.strictObject({ identity: nativeEngineeringCheckEvidenceSchema.shape.identity,
  leaseId: z.uuid(), baseCommit: z.string().regex(/^[a-f0-9]{40}$/), generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export type TrustedToolBinding = Readonly<z.infer<typeof bindingSchema>>;
export const calculatorToolArguments = z.strictObject({ expectedSha256: hash,
  contentsBase64: z.string().max(2732).refine(value => {
    const bytes = Buffer.from(value, 'base64');
    return bytes.length <= CALCULATOR_TOOL_BYTES && bytes.toString('base64') === value;
  }), });
export type CalculatorToolArguments = z.infer<typeof calculatorToolArguments>;
export type ToolWriteOutcome = Readonly<{ state: 'written'; callId: string; sha256: string; bytes: number }
  | { state: 'rejected'; code: 'invalid-request' | 'sealed' | 'binding' | 'conflict' | 'ownership-or-target' }
  | { state: 'unknown' }>;
export type HostToolClose = Readonly<{ hostWrite: 'settled' | 'unknown'; nativeWriteAccess: 'unknown' }>;
/** Trusted host port. It owns exactly one pinned regular file, no path from model arguments.
 * All promises must settle only after actual I/O. close cannot stand in for pending writes. */
export interface CalculatorToolFile {
  readonly identity: Readonly<{ path: string; device: string; inode: string }>;
  read(): Promise<Uint8Array>;
  replace(contents: Uint8Array): Promise<void>;
  close(): Promise<void>;
}
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** A dedicated host capability, not NativeWriteAuthority or an OS sandbox for the host UID. */
export function createTrustedToolWriter(options: { binding: TrustedToolBinding; target: CalculatorToolFile;
  signal: AbortSignal; assertOwnership(binding: TrustedToolBinding): Promise<void> }) {
  const parsed = bindingSchema.parse(options.binding);
  const binding = Object.freeze({ ...parsed, identity: Object.freeze(parsed.identity) });
  let turn: Readonly<{ threadId: string; turnId: string }> | undefined;
  let sealed = options.signal.aborted, unknown = false;
  let entry: { callId: string; body: string; operation: Promise<ToolWriteOutcome> } | undefined;
  let closing: Promise<HostToolClose> | undefined;
  const seal = () => { sealed = true; };
  options.signal.addEventListener('abort', seal, { once: true });
  const rejected = (code: Extract<ToolWriteOutcome, { state: 'rejected' }>['code']): ToolWriteOutcome => ({ state: 'rejected', code });
  async function ownership() {
    if (sealed || options.signal.aborted) throw Error('Tool admission sealed.');
    await options.assertOwnership(binding);
    if (sealed || options.signal.aborted) throw Error('Tool admission sealed.');
  }
  async function execute(callId: string, args: CalculatorToolArguments): Promise<ToolWriteOutcome> {
    let writeStarted = false;
    try {
      await ownership();
      if (digest(await options.target.read()) !== args.expectedSha256) { seal(); return rejected('conflict'); }
      // Recheck the current lease after reading; neither a stored request nor a prior ACK grants ownership.
      await ownership();
      const contents = Buffer.from(args.contentsBase64, 'base64');
      writeStarted = true;
      await options.target.replace(contents);
      const actual = await options.target.read();
      if (digest(actual) !== digest(contents)) throw Error('Tool write observation differs.');
      return Object.freeze({ state: 'written', callId, sha256: digest(actual), bytes: actual.length });
    } catch {
      seal();
      if (writeStarted) { unknown = true; return { state: 'unknown' }; }
      return rejected('ownership-or-target');
    }
  }
  function observe(operation: Promise<ToolWriteOutcome>, signal: AbortSignal): Promise<ToolWriteOutcome> {
    // Stop waiting on cancellation, but retain entry.operation until actual I/O and close settle.
    // An unknown reply is never permission to release the workspace or mint a revoked grant.
    return new Promise(resolve => {
      const abort = () => { seal(); unknown = true; resolve({ state: 'unknown' }); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      operation.then(value => { signal.removeEventListener('abort', abort); resolve(value); });
    });
  }
  return {
    binding,
    seal,
    /** Called by the trusted recipe only after its shared evidence matches both receipt identities. */
    bindTurn(threadId: string, turnId: string) {
      id.parse(threadId); id.parse(turnId);
      if (sealed || (turn && (turn.threadId !== threadId || turn.turnId !== turnId))) { seal(); throw Error('Tool turn binding differs.'); }
      turn ??= Object.freeze({ threadId, turnId });
    },
    async invoke(input: { threadId: string; turnId: string; callId: string; arguments: unknown }, signal = options.signal): Promise<ToolWriteOutcome> {
      const args = calculatorToolArguments.safeParse(input.arguments);
      if (!args.success || !id.safeParse(input.callId).success) { seal(); return rejected('invalid-request'); }
      if (!turn || turn.threadId !== input.threadId || turn.turnId !== input.turnId) { seal(); return rejected('binding'); }
      if (sealed) return rejected('sealed');
      if (signal.aborted) { seal(); return { state: 'unknown' }; }
      const body = JSON.stringify(args.data);
      if (entry) {
        if (entry.callId !== input.callId || entry.body !== body) { seal(); return rejected('conflict'); }
        const replay = ownership().then(() => entry!.operation, () => { seal(); return rejected('ownership-or-target'); });
        return observe(replay, signal); // One memoized outcome. Never retry the write on lost ACK.
      }
      const operation = execute(input.callId, args.data);
      entry = { callId: input.callId, body, operation };
      return observe(operation, signal);
    },
    close(signal: AbortSignal): Promise<HostToolClose> {
      seal(); // Synchronous: a late ownership callback cannot reopen admission.
      closing ??= (async () => {
        try { await entry?.operation; await options.target.close(); }
        catch { unknown = true; }
        finally { options.signal.removeEventListener('abort', seal); }
        return { hostWrite: unknown ? 'unknown' : 'settled', nativeWriteAccess: 'unknown' } as const;
      })();
      return new Promise(resolve => {
        const abort = () => { unknown = true; resolve({ hostWrite: 'unknown', nativeWriteAccess: 'unknown' }); };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        closing!.then(result => { signal.removeEventListener('abort', abort); resolve(result); });
      });
    },
  };
}
export type TrustedToolWriter = ReturnType<typeof createTrustedToolWriter>;

/** Opens only an existing canonical calculator file. The owner must already exclude other writers.
 * This does not revoke ambient host privileges or enforce the native process's read-only policy. */
export async function openCalculatorToolFile(directory: string): Promise<CalculatorToolFile> {
  if (resolve(directory) !== directory || await realpath(directory) !== directory) throw Error('Tool directory must be canonical.');
  const path = join(directory, 'calculator.mjs');
  const before = await lstat(path, { bigint: true });
  checkRegular(before);
  const handle = await open(path, constants.O_RDWR | constants.O_NOFOLLOW);
  let closed = false;
  async function checkIdentity() {
    const [file, named] = await Promise.all([handle.stat({ bigint: true }), lstat(path, { bigint: true })]);
    for (const stat of [file, named]) {
      checkRegular(stat);
      if (stat.dev !== before.dev || stat.ino !== before.ino) throw Error('Tool file identity changed.');
    }
  }
  try { await checkIdentity(); }
  catch (error) { await handle.close(); throw error; }
  return {
    identity: Object.freeze({ path, device: String(before.dev), inode: String(before.ino) }),
    async read() {
      await checkIdentity();
      const bytes = await readBounded(handle);
      await checkIdentity();
      return bytes;
    },
    async replace(contents) {
      if (contents.byteLength > CALCULATOR_TOOL_BYTES) throw Error('Tool content exceeds bound.');
      await checkIdentity();
      let offset = 0;
      while (offset < contents.byteLength) {
        const { bytesWritten } = await handle.write(contents, offset, contents.byteLength - offset, offset);
        if (!bytesWritten) throw Error('Tool write made no progress.');
        offset += bytesWritten;
      }
      await handle.truncate(contents.byteLength);
      await handle.sync();
      await checkIdentity();
    },
    async close() { if (!closed) { await handle.close(); closed = true; } },
  };
}
function checkRegular(stat: { isFile(): boolean; uid: bigint; nlink: bigint; size: bigint }) {
  if (!stat.isFile() || stat.nlink !== 1n || stat.uid !== BigInt(process.getuid!()) || stat.size > BigInt(CALCULATOR_TOOL_BYTES)) throw Error('Tool file is not a bounded owned regular file.');
}
async function readBounded(handle: FileHandle): Promise<Uint8Array> {
  const bytes = Buffer.alloc(CALCULATOR_TOOL_BYTES + 1);
  let offset = 0;
  while (offset < bytes.length) {
    const result = await handle.read(bytes, offset, bytes.length - offset, offset);
    if (!result.bytesRead) break;
    offset += result.bytesRead;
  }
  if (offset > CALCULATOR_TOOL_BYTES) throw Error('Tool file exceeds bound.');
  return bytes.subarray(0, offset);
}
