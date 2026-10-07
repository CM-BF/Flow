import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { createCodexTransport, type CodexTransport } from '../codex/index.js';
import type { CodexTransportFactory } from '../native-harness/codex/exchange.js';
import { createDarwinWriteProfile } from './native-authority-darwin.js';

const SANDBOX = '/usr/bin/sandbox-exec';
const SANDBOX_SHA256 = 'abc5bb136d6b5cce8fa85d789f78e3326c51ca60cae637b2064adfb67a1dcd9a';
type FileIdentity = ReturnType<typeof lstatSync>;
export interface DarwinWriterHostInput {
  /** Trusted host configuration, never task JSON or model arguments. */
  readonly directory: string;
  readonly executable: string;
  readonly executableSha256: string;
  readonly arguments: readonly string[];
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
