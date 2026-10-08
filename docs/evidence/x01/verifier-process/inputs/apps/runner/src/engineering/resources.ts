import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { EngineeringReceipt } from '../../../../packages/contracts/src/engineering.js';

export const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export type CommandResult = EngineeringReceipt['command'];
export interface Command { executable: string; args: string[]; cwd: string; timeoutMs?: number; outputBytes?: number; signal?: AbortSignal }
const environment = { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };

/** Only trusted registry code constructs a command. No task fields become shell, argv or environment. */
export async function runCommand(command: Command): Promise<CommandResult> {
  const started = performance.now(), limit = command.outputBytes ?? 65_536;
  const timeout = command.timeoutMs ?? 5000;
  if (timeout < 1 || timeout > 30_000 || limit < 1 || limit > 1_048_576) throw new Error('Invalid engineering command bounds.');
  if (command.signal?.aborted) return { exitCode: null, signal: null, timedOut: false, outputTruncated: false, childExited: true, elapsedMs: 0, stdout: '', stderr: '' };
  return new Promise(resolve => {
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), timedOut = false, outputTruncated = false, done = false;
    let killTimer: NodeJS.Timeout | undefined, closeTimer: NodeJS.Timeout | undefined;
    const child = spawn(command.executable, command.args, { cwd: command.cwd, env: environment, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const finish = (exitCode: number | null, signal: string | null, childExited: boolean) => {
      if (done) return; done = true;
      clearTimeout(timer); clearTimeout(killTimer); clearTimeout(closeTimer); command.signal?.removeEventListener('abort', stop);
      child.stdout.destroy(); child.stderr.destroy();
      if (!childExited) child.unref();
      resolve({ exitCode, signal, timedOut, outputTruncated, childExited, elapsedMs: Math.round(performance.now() - started), stdout: boundedText(stdout, limit), stderr: boundedText(stderr, limit) });
    };
    const kill = (signal: NodeJS.Signals) => { if (child.pid) { try { process.kill(-child.pid, signal); } catch { /* Already gone; close confirms settlement. */ } } };
    const stop = () => {
      if (done || killTimer) return;
      kill('SIGTERM'); killTimer = setTimeout(() => kill('SIGKILL'), 100);
      closeTimer = setTimeout(() => finish(null, null, false), 1000);
    };
    const collect = (part: Buffer, stream: 'stdout' | 'stderr') => {
      const current = stream === 'stdout' ? stdout : stderr;
      const next = Buffer.concat([current, part.subarray(0, Math.max(0, limit - current.length))]);
      if (stream === 'stdout') stdout = next; else stderr = next;
      if (current.length + part.length > limit) { outputTruncated = true; stop(); }
    };
    child.stdout.on('data', (chunk: Buffer) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => collect(chunk, 'stderr'));
    child.once('error', () => finish(null, null, child.pid === undefined));
    child.once('close', (code, signal) => finish(code, signal, true));
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeout);
    command.signal?.addEventListener('abort', stop, { once: true });
    if (command.signal?.aborted) stop();
  });
}

function boundedText(buffer: Buffer, maximum: number): string {
  let text = buffer.toString('utf8');
  while (Buffer.byteLength(text) > maximum) text = text.slice(0, -1);
  return text;
}

/** Nonblocking + no-follow prevents special-file/symlink replacement from hanging the host. */
export async function readTextFile(path: string, maximum: number): Promise<{ content: string; mode: '100644' | '100755' }> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > maximum) throw new Error('Engineering requires a bounded regular file.');
    const buffer = Buffer.alloc(maximum + 1), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const after = await handle.stat();
    if (bytesRead > maximum || bytesRead !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('Engineering file changed while reading.');
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead));
    if (content.includes('\0')) throw new Error('Binary engineering files are unsupported.');
    return { content, mode: (before.mode & 0o111) !== 0 ? '100755' : '100644' };
  } finally { await handle.close(); }
}
