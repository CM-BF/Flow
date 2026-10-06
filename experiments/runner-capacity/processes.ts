import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface Observation { kind: string; pid: number; receivedAtMs: number; [key: string]: unknown }
export interface OwnedProcess { child: ChildProcess; pid: number; role: string; ready: Record<string, unknown>; exited: Promise<number | null> }
export async function startProcess(config: Record<string, unknown>, collect: (value: Observation) => void, processes: OwnedProcess[], deadline: number): Promise<OwnedProcess> {
  if (performance.now() >= deadline) throw new Error('S01 child startup has no work budget remaining.');
  const child = fork(fileURLToPath(new URL('./child.ts', import.meta.url)), [], {
    execPath: process.execPath, execArgv: ['--import', 'tsx'],
    env: { PATH: process.env.PATH, TSX_TSCONFIG_PATH: fileURLToPath(new URL('./tsconfig.json', import.meta.url)) },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  const owned: OwnedProcess = { child, pid: child.pid!, role: String(config.role), ready: {}, exited: new Promise(resolve => child.once('close', code => resolve(code))) };
  processes.push(owned); // Ownership is recorded before readiness; failed startup must also be cleaned up.
  child.stderr?.on('data', bytes => collect({ kind: 'child-stderr', pid: owned.pid, receivedAtMs: performance.now(), bytes: Buffer.byteLength(bytes), contentRetained: false }));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('S01 child readiness deadline exceeded.')), Math.max(1, Math.min(12000, deadline - performance.now())));
    child.once('error', () => { clearTimeout(timer); reject(new Error('S01 owned child could not start.')); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('S01 owned child exited before readiness.')); });
    child.on('message', value => {
      const record = value as Record<string, unknown>;
      collect({ ...record, kind: String(record.kind), pid: owned.pid, receivedAtMs: performance.now() });
      if (record.kind === 'ready') { clearTimeout(timer); owned.ready = record; resolve(); }
      if (record.kind === 'failure') { clearTimeout(timer); reject(new Error('S01 owned child reported failure.')); }
    });
    child.send(config, error => { if (error) { clearTimeout(timer); reject(new Error('S01 startup IPC failed.')); } });
  });
  return owned;
}

async function waitForClose(owned: OwnedProcess, deadline: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([owned.exited.then(() => true), new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), Math.max(1, deadline - performance.now()));
    })]);
  } finally { clearTimeout(timer); }
}

export async function stopProcess(owned: OwnedProcess, deadline: number) {
  let ipcFailed = false;
  try {
    if (owned.child.connected) owned.child.send({ kind: 'stop' }, error => { if (error) ipcFailed = true; });
  } catch { ipcFailed = true; } // IPC failure never bypasses reaping this owned process.
  let forced = false;
  const normal = await waitForClose(owned, Math.min(performance.now() + 4000, deadline - 1500));
  if (!normal) {
    forced = true;
    owned.child.kill('SIGTERM');
    if (!await waitForClose(owned, deadline - 500)) owned.child.kill('SIGKILL');
  }
  const exited = await waitForClose(owned, deadline);
  return { pid: owned.pid, role: owned.role, exited, forced, ipcFailed, exitCode: owned.child.exitCode, signal: owned.child.signalCode };
}
