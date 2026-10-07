import { createHash } from 'node:crypto';
import { constants, lstatSync, realpathSync, openSync, fstatSync, readSync, closeSync, type Stats } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCodexTransport, type CodexTransport } from '../codex/index.js';
import type { PrivateStderrSink } from '../codex/types.js';
import type { CodexTransportFactory } from '../native-harness/codex/exchange.js';
import { createDarwinWriteProfile, createStockHelperProfile, createStockReadOnlyProfile, STOCK_CODEX, STOCK_CODEX_SHA256 } from './native-authority-darwin.js';

const SANDBOX = '/usr/bin/sandbox-exec';
const SANDBOX_SHA256 = 'abc5bb136d6b5cce8fa85d789f78e3326c51ca60cae637b2064adfb67a1dcd9a';
type FileIdentity = Stats;
export interface DarwinWriterHostInput {
  /** Trusted host configuration, never task JSON or model arguments. */
  readonly directory: string;
  readonly executable: string;
  readonly executableSha256: string;
  readonly arguments: readonly string[];
}

export interface StockHelperInput {
  /** Trusted host paths; neither path is supplied by a model request. */
  readonly directory: string;
  readonly runtimeDirectory: string;
  readonly startupRecipe: string;
  readonly contents: Uint8Array;
}
export type DarwinReadOnlyHostInput = Pick<StockHelperInput, 'directory' | 'runtimeDirectory' | 'startupRecipe'> & {
  /** Optional trusted diagnostic sink. Native bytes remain private; at most 8192 are retained. */
  readonly privateStderr?: PrivateStderrSink;
};
export interface DarwinReadOnlyHost {
  readonly policySha256: string;
  readonly createTransport: CodexTransportFactory;
  close(): Promise<DarwinWriterStop>;
}
export interface StockHelperCompletion {
  /** Facts from the one supervisor that actually owned the launched child. */
  readonly exitCode: number | null;
  readonly ownedState: 'absent' | 'present' | 'unknown';
  readonly stdoutEof: boolean;
  readonly stderrEof: boolean;
  readonly failure: boolean;
  readonly stdout: string;
}

function privateDirectory(path: string): Stats {
  const value = lstatSync(path);
  if (realpathSync(path) !== path || !value.isDirectory() || value.uid !== process.getuid?.() || (value.mode & 0o077)) {
    throw Error('Stock helper private directory is invalid.');
  }
  return value;
}

/** Prepare one non-RPC helper launch. No process starts here: R06's initialize
 * exchange cannot be sent to this one-line protocol. The existing supervisor
 * caller owns spawn/stop and must supply read-only stdin and no extra FDs. */
export async function prepareDarwinStockHelper(input: StockHelperInput) {
  if (process.platform !== 'darwin') throw Error('Darwin stock helper is unavailable.');
  const contents = Buffer.from(input.contents);
  if (contents.length > 1024) throw Error('Stock helper write exceeds 1024 bytes.');
  const { directory, runtimeDirectory } = input;
  const profile = createStockHelperProfile(input);
  const directories = [directory, runtimeDirectory, join(runtimeDirectory, 'control'), join(runtimeDirectory, 'state')]
    .map(path => ({ path, identity: privateDirectory(path) }));
  const target = join(directory, 'calculator.mjs'), original = ownedFile(target);
  if (original.size > 65536) throw Error('Stock helper target exceeds 65536 bytes.');
  const binary = ownedFile(STOCK_CODEX), sandbox = lstatSync(SANDBOX);
  if (!(binary.mode & 0o111)) throw Error('Stock helper executable is invalid.');
  await verifyDigest(STOCK_CODEX, STOCK_CODEX_SHA256, 512 * 1024 * 1024);
  await verifyDigest(SANDBOX, SANDBOX_SHA256, 1024 * 1024);
  const policySha256 = createHash('sha256').update(profile).digest('hex');
  const requestLine = JSON.stringify({ operation: 'fs/writeFile', params: {
    path: pathToFileURL(target).href, dataBase64: contents.toString('base64'), followSymlinks: false, sandbox: null,
  } }) + '\n';
  if (Buffer.byteLength(requestLine) > 8192) throw Error('Stock helper request exceeds 8192 bytes.');
  let taken = false, issued = false;
  return Object.freeze({
    policySha256,
    /** Taking the spec consumes the launch even if validation/abort fails. Never retry an unknown spawn. */
    takeLaunch(signal: AbortSignal) {
      if (taken) throw Error('Stock helper launch already taken.');
      taken = true;
      signal.throwIfAborted();
      for (const { path, identity } of directories) {
        const now = privateDirectory(path);
        if (now.dev !== identity.dev || now.ino !== identity.ino) throw Error('Stock helper directory changed.');
      }
      if (!sameFile(STOCK_CODEX, binary) || !sameFile(SANDBOX, sandbox) || !sameFile(target, original)) {
        throw Error('Stock helper launch identity changed.');
      }
      issued = true;
      return Object.freeze({ executable: SANDBOX, args: Object.freeze(['-p', profile, STOCK_CODEX, '--codex-run-as-fs-helper']),
        cwd: directory, environment: Object.freeze({ PATH: '/usr/bin:/bin', LANG: 'C', HOME: join(runtimeDirectory, 'state'),
          TMPDIR: join(runtimeDirectory, 'state'), CODEX_HOME: join(runtimeDirectory, 'state') }), requestLine,
        stdin: 'readonly-regular-file' as const, extraDescriptors: 'closed' as const });
    },
    /** Observation only, never a grant or proof that every delegated writer stopped.
     * Errors/partial output/unknown cleanup preserve unknown, including exit-zero error payloads. */
    async observe(completion: StockHelperCompletion): Promise<{ outcome: 'observed-write' | 'unknown'; writeAccess: 'unknown' }> {
      const unknown = { outcome: 'unknown', writeAccess: 'unknown' } as const;
      if (!issued || completion.exitCode !== 0 || completion.ownedState !== 'absent' || completion.failure
        || !completion.stdoutEof || !completion.stderrEof || Buffer.byteLength(completion.stdout) > 16384) return unknown;
      try {
        const reply: unknown = JSON.parse(completion.stdout);
        if (!reply || typeof reply !== 'object' || !('status' in reply) || reply.status !== 'ok'
          || !('payload' in reply) || !reply.payload || typeof reply.payload !== 'object'
          || !('operation' in reply.payload) || reply.payload.operation !== 'fs/writeFile'
          || !('response' in reply.payload) || !reply.payload.response || typeof reply.payload.response !== 'object'
          || Array.isArray(reply.payload.response) || Object.keys(reply.payload.response).length !== 0) return unknown;
        const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.dev !== original.dev || stat.ino !== original.ino || stat.nlink !== 1
            || stat.uid !== original.uid || (stat.mode & 0o022) || stat.size !== contents.length) return unknown;
          const bytes = Buffer.alloc(contents.length + 1);
          const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
          if (bytesRead !== contents.length || !bytes.subarray(0, bytesRead).equals(contents) || !sameFile(target, stat)) return unknown;
          return { outcome: 'observed-write', writeAccess: 'unknown' };
        } finally { await file.close(); }
      } catch { return unknown; }
    },
  });
}
export interface DarwinWriterStop {
  readonly policySha256: string;
  readonly child: 'not-started' | 'confirmed-exited' | 'unconfirmed';
  /** Local process facts are insufficient to assert model qualification/all delegation. */
  readonly writeAccess: 'unknown';
}

function sameFile(path: string, expected: FileIdentity): boolean {
  const current = lstatSync(path);
  return !current.isSymbolicLink() && current.dev === expected.dev && current.ino === expected.ino
    && current.size === expected.size && current.mtimeMs === expected.mtimeMs && current.ctimeMs === expected.ctimeMs;
}
function ownedFile(path: string): FileIdentity {
  const value = lstatSync(path);
  if (realpathSync(path) !== path || !value.isFile() || value.nlink !== 1 || value.uid !== process.getuid?.() || (value.mode & 0o022)) {
    throw Error('Darwin host file identity is invalid.');
  }
  return value;
}
async function verifyDigest(path: string, expected: string, maximumBytes: number): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw Error('Darwin executable digest is invalid.');
  const file = await open(path, 'r');
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > maximumBytes) throw Error('Darwin executable size is invalid.');
    const hash = createHash('sha256'), buffer = Buffer.alloc(65536);
    for (let position = 0; position < metadata.size;) {
      const read = await file.read(buffer, 0, Math.min(buffer.length, metadata.size - position), position);
      if (!read.bytesRead) throw Error('Darwin executable changed while reading.');
      hash.update(buffer.subarray(0, read.bytesRead)); position += read.bytesRead;
    }
    if (hash.digest('hex') !== expected) throw Error('Darwin executable digest differs.');
  } finally { await file.close(); }
}

/** The existing R06 factory owns the only native child and its three stdio pipes.
 * No process starts during preparation; no workspace FD or ambient environment is passed. */
export async function prepareDarwinReadOnlyHost(input: DarwinReadOnlyHostInput): Promise<DarwinReadOnlyHost> {
  if (process.platform !== 'darwin') throw Error('Darwin read-only host is unavailable.');
  const { directory, runtimeDirectory } = input;
  const profile = createStockReadOnlyProfile(input);
  const privateStderr = input.privateStderr === undefined ? undefined : Object.freeze({
    maxBytes: input.privateStderr.maxBytes, write: input.privateStderr.write,
  });
  if (privateStderr && (!Number.isSafeInteger(privateStderr.maxBytes) || privateStderr.maxBytes < 1
    || privateStderr.maxBytes > 8192 || typeof privateStderr.write !== 'function')) throw Error('Read-only stderr limit is invalid.');
  const directories = [directory, runtimeDirectory, join(runtimeDirectory, 'control'), join(runtimeDirectory, 'state')]
    .map(path => ({ path, identity: privateDirectory(path) }));
  const binary = ownedFile(STOCK_CODEX), sandbox = lstatSync(SANDBOX);
  if (!(binary.mode & 0o111)) throw Error('Read-only host executable is invalid.');
  await verifyDigest(STOCK_CODEX, STOCK_CODEX_SHA256, 512 * 1024 * 1024);
  await verifyDigest(SANDBOX, SANDBOX_SHA256, 1024 * 1024);
  const policySha256 = createHash('sha256').update(profile).digest('hex');
  // The reviewed profile exceeds R06's per-argument bound. Retain an exclusive control file;
  // never widen that shared bound, overwrite a previous attempt, or remove evidence on failure.
  const policyPath = join(runtimeDirectory, 'control', 'flow-readonly.sb');
  const policyFile = await open(policyPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await policyFile.writeFile(profile); await policyFile.sync(); } finally { await policyFile.close(); }
  const control = await open(join(runtimeDirectory, 'control'), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await control.sync(); } finally { await control.close(); }
  const policyIdentity = ownedFile(policyPath);
  let attempted = false, stopped = false, transport: CodexTransport | undefined;
  let closing: Promise<DarwinWriterStop> | undefined;
  const createTransport: CodexTransportFactory = ({ signal, workingDirectory }) => {
    if (attempted || stopped) throw Error('Read-only launch already consumed.');
    attempted = true;
    signal.throwIfAborted();
    if (workingDirectory !== directory) throw Error('Read-only workspace differs.');
    for (const { path, identity } of directories) {
      const now = privateDirectory(path);
      if (now.dev !== identity.dev || now.ino !== identity.ino) throw Error('Read-only directory changed.');
    }
    if (!sameFile(STOCK_CODEX, binary) || !sameFile(SANDBOX, sandbox)) throw Error('Read-only executable changed.');
    assertPolicyFile(policyPath, policyIdentity, profile, policySha256);
    transport = createCodexTransport({
      spawn: { executable: SANDBOX, args: ['-f', policyPath, STOCK_CODEX, 'app-server'], cwd: directory,
        environment: { PATH: '/usr/bin:/bin', LANG: 'C', HOME: join(runtimeDirectory, 'state'),
          TMPDIR: join(runtimeDirectory, 'state'), CODEX_HOME: join(runtimeDirectory, 'state') } },
      initialize: { clientInfo: { name: 'flow-readonly-tool-host', title: null, version: '1' },
        capabilities: { experimentalApi: true, requestAttestation: false } },
      limits: { frameBytes: 16384, inboundBytes: 32768, outboundBytes: 32768, inboundFrames: 32, outboundFrames: 32,
        pendingRequests: 8, serverRequests: 8, initializeTimeoutMs: 2000, terminateMs: 200, killMs: 300 }, signal,
      ...(privateStderr === undefined ? {} : { privateStderr }),
    });
    return transport;
  };
  return Object.freeze({ policySha256, createTransport, close() {
    stopped = true;
    closing ??= (async (): Promise<DarwinWriterStop> => {
      let child: DarwinWriterStop['child'] = attempted ? 'unconfirmed' : 'not-started';
      try { if (transport) child = (await transport.close()).child; } catch { /* Unknown is retained. */ }
      return { policySha256, child, writeAccess: 'unknown' };
    })();
    return closing;
  } });
}

function assertPolicyFile(path: string, expected: FileIdentity, profile: string, sha256: string): void {
  if (!sameFile(path, expected)) throw Error('Read-only profile identity changed.');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const value = fstatSync(fd), bytes = Buffer.alloc(Buffer.byteLength(profile) + 1);
    if (!value.isFile() || value.dev !== expected.dev || value.ino !== expected.ino || value.nlink !== 1
      || value.uid !== expected.uid || (value.mode & 0o777) !== 0o600 || value.size !== bytes.length - 1) throw Error('Read-only profile file changed.');
    let offset = 0;
    while (offset < bytes.length) { const count = readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) break; offset += count; }
    if (offset !== value.size || createHash('sha256').update(bytes.subarray(0, offset)).digest('hex') !== sha256
      || !sameFile(path, expected)) throw Error('Read-only profile bytes changed.');
  } finally { closeSync(fd); }
}

/** A real OS launch seam. It deliberately does not mint NativeWriteAuthority's
 * locked-no-fallback grant; actual model/IPC/native-tool qualification is separate. */
export async function prepareDarwinWriterHost(input: DarwinWriterHostInput): Promise<{
  readonly policySha256: string; readonly createTransport: CodexTransportFactory; close(): Promise<DarwinWriterStop>;
}> {
  if (process.platform !== 'darwin') throw Error('Darwin write host is unavailable.');
  const directory = input.directory, executable = input.executable, args = [...input.arguments];
  if (args.length > 8 || args.some(arg => typeof arg !== 'string' || Buffer.byteLength(arg) > 512 || /[\0\r\n]/.test(arg))) {
    throw Error('Darwin host arguments are invalid.');
  }
  const root = lstatSync(directory), target = join(directory, 'calculator.mjs');
  if (!root.isDirectory() || realpathSync(directory) !== directory || root.uid !== process.getuid?.() || (root.mode & 0o077)) {
    throw Error('Darwin workspace identity is invalid.');
  }
  const binary = ownedFile(executable), writable = ownedFile(target);
  if (!(binary.mode & 0o111) || binary.dev === writable.dev && binary.ino === writable.ino) throw Error('Darwin executable identity is invalid.');
  await verifyDigest(executable, input.executableSha256, 512 * 1024 * 1024);
  await verifyDigest(SANDBOX, SANDBOX_SHA256, 1024 * 1024);
  const sandbox = lstatSync(SANDBOX);
  const profile = createDarwinWriteProfile({ root: directory, executable, writableFile: target });
  const policySha256 = createHash('sha256').update(profile).digest('hex');
  let attempted = false, stopped = false, transport: CodexTransport | undefined;
  const createTransport: CodexTransportFactory = ({ signal, workingDirectory }) => {
    if (attempted || stopped) throw Error('Darwin writer launch has already settled.');
    attempted = true;
    signal.throwIfAborted();
    const now = lstatSync(directory);
    if (workingDirectory !== directory || now.dev !== root.dev || now.ino !== root.ino || !now.isDirectory()
      || !sameFile(executable, binary) || !sameFile(target, writable) || !sameFile(SANDBOX, sandbox)) throw Error('Darwin launch identity changed.');
    // R06 exclusively owns spawn and fixes stdio to three pipes; no inherited FD/IPC option is exposed.
    transport = createCodexTransport({
      spawn: { executable: SANDBOX, args: ['-p', profile, executable, ...args], cwd: directory,
        environment: { PATH: '/usr/bin:/bin', HOME: directory, TMPDIR: directory, LANG: 'C' } },
      initialize: { clientInfo: { name: 'flow-engineering-host', title: null, version: '1' }, capabilities: null },
      limits: { frameBytes: 16384, inboundBytes: 32768, outboundBytes: 32768, inboundFrames: 32, outboundFrames: 32,
        pendingRequests: 8, serverRequests: 8, initializeTimeoutMs: 2000, terminateMs: 200, killMs: 300 }, signal,
    });
    return transport;
  };
  return Object.freeze({ policySha256, createTransport, async close(): Promise<DarwinWriterStop> {
    stopped = true;
    const child = transport ? (await transport.close()).child : attempted ? 'unconfirmed' : 'not-started';
    return { policySha256, child, writeAccess: 'unknown' };
  } });
}
