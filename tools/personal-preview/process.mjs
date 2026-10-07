import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const execute = promisify(execFile);
async function identity(pid) {
  try {
    const { stdout } = await execute('ps', ['-p', String(pid), '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='], { env: { ...process.env, LC_ALL: 'C' }, timeout: 1000 });
    const match = /^\s*(\d+)\s+(.{24})\s+(.+?)\s*$/.exec(stdout);
    return match ? { pid, group: Number(match[1]), startedAt: match[2], command: match[3] } : null;
  } catch { return null; }
}
function groupExists(group) {
  try { process.kill(-group, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
export async function inspectOwnedProcess(record) {
  if (!record || !Number.isSafeInteger(record.pid) || record.pid < 2 || record.group !== record.pid || typeof record.nonce !== 'string') return 'unknown';
  const current = await identity(record.pid);
  if (!current) return groupExists(record.group) ? 'unknown' : 'stopped';
  return current.group === record.group && current.startedAt === record.startedAt && current.command === record.command
    && current.command.includes(`--flow-preview=${record.nonce}`) ? 'running' : 'unknown';
}
/** One real probe supplies both the readiness evidence and the legacy boolean. No command output is retained. */
export async function observeOwnedListener(record, port) {
  const ownerState = await inspectOwnedProcess(record);
  const result = { owned: false, ownerState, phase: 'owner', listenerCount: null, code: null, exitCode: null };
  if (ownerState !== 'running') return result;
  try {
    result.phase = 'listener-query';
    const { stdout } = await execute('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { timeout: 1000 });
    const pids = [...new Set(stdout.trim().split(/\s+/).map(Number))];
    result.phase = 'listener-pids';
    if (!pids.length || pids.some(pid => !Number.isSafeInteger(pid) || pid < 2)) return result;
    result.listenerCount = pids.length; result.phase = 'listener-owner';
    for (const pid of pids) if ((await identity(pid))?.group !== record.group) return result;
    return { ...result, owned: true, phase: 'confirmed' };
  } catch (error) {
    result.code = ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(error?.code) ? error.code : null;
    result.exitCode = Number.isSafeInteger(error?.code) ? error.code : null;
    return result;
  }
}
export async function ownsListener(record, port) {
  return (await observeOwnedListener(record, port)).owned;
}
export async function spawnOwnedProcess({ args, cwd, env, onSpawn }) {
  if (process.platform === 'win32') throw new Error('POSIX process ownership is required.');
  const nonce = randomUUID();
  const child = spawn(process.execPath, [...args, `--flow-preview=${nonce}`], { cwd, env, detached: true, stdio: 'ignore' });
  let failed = false;
  child.once('error', () => { failed = true; }); child.unref();
  if (child.pid && onSpawn) await onSpawn({ pid: child.pid, group: child.pid, nonce, startedAt: null, command: null });
  const deadline = Date.now() + 2000;
  while (!failed && child.pid && Date.now() < deadline) {
    const found = await identity(child.pid);
    if (found?.group === child.pid && found.command.includes(`--flow-preview=${nonce}`)) return { ...found, nonce };
    await sleep(20);
  }
  // Never signal an identity that was not positively captured.
  throw new Error('Process start could not be confirmed; inspect the private state before retrying.');
}
export async function stopOwnedProcess(record, timeoutMs = 5000) {
  const state = await inspectOwnedProcess(record);
  if (state !== 'running') return state;
  // Recheck immediately before signaling this recorded group; no port scans or PID-only kills.
  if (await inspectOwnedProcess(record) !== 'running') return 'unknown';
  try { process.kill(-record.group, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') return 'unknown'; }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!groupExists(record.group)) return 'stopped';
    await sleep(25);
  }
  return groupExists(record.group) ? 'unknown' : 'stopped';
}
