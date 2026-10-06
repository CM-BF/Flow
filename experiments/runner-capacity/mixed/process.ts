import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONTRACT, deferred } from './contract.js';
import type { OwnedProcess } from '../processes.js';
import type { RecordValue } from './channel.js';
export type Observation = RecordValue & { receivedMs: number; pid: number };
export async function launch(config: Record<string, unknown>, owned: OwnedProcess[], receive: (value: Observation) => void, charge: (kind: string, bytes: number) => void, timeoutMs: number): Promise<OwnedProcess> {
  const child = fork(fileURLToPath(new URL('./child.ts', import.meta.url)), [], {
    execPath: process.execPath, execArgv: ['--import', 'tsx'],
    env: { PATH: process.env.PATH, TSX_TSCONFIG_PATH: fileURLToPath(new URL('./tsconfig.json', import.meta.url)) },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  const ready = deferred<Record<string, unknown>>(); void ready.promise.catch(() => {});
  const result: OwnedProcess = { child, pid: child.pid!, role: String(config.role), ready: {}, exited: new Promise(resolve => child.once('close', resolve)) };
  owned.push(result);
  child.stderr?.on('data', (bytes: Buffer) => { charge('stderr', bytes.length); receive({ kind: 'stderr', pid: result.pid, receivedMs: performance.now(), bytes: bytes.length }); });
  child.on('message', (value: RecordValue) => {
    charge('ipc-in', Buffer.byteLength(JSON.stringify(value)));
    receive({ ...value, receivedMs: performance.now(), pid: result.pid });
    if (value.kind === 'ready') ready.resolve(value);
    if (value.kind === 'failure') ready.reject(new Error('child_failed'));
  });
  child.once('error', () => ready.reject(new Error('child_spawn_failed')));
  child.once('exit', () => ready.reject(new Error('child_exited_before_ready')));
  const timer = setTimeout(() => ready.reject(new Error('child_ready_timeout')), timeoutMs);
  try { await transmit(result, config, charge); result.ready = await ready.promise; return result; }
  finally { clearTimeout(timer); }
}
export async function transmit(owned: OwnedProcess, record: Record<string, unknown>, charge: (kind: string, bytes: number) => void) {
  const bytes = Buffer.byteLength(JSON.stringify(record));
  if (bytes > CONTRACT.responseBytes) throw new Error('ipc_payload_too_large');
  charge('ipc-out', bytes);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ipc_send_timeout')), CONTRACT.requestMs);
    try { owned.child.send(record, error => { clearTimeout(timer); error ? reject(new Error('ipc_send_failed')) : resolve(); }); }
    catch { clearTimeout(timer); reject(new Error('ipc_send_failed')); }
  });
}
