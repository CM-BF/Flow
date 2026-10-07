import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CONTRACT, deferred, type RunContract } from './contract.js';
import type { OwnedProcess } from '../processes.js';
import type { RecordValue } from './channel.js';
export type Observation = RecordValue & { receivedMs: number; pid: number };
export async function launch(config: Record<string, unknown>, owned: OwnedProcess[], receive: (value: Observation) => void, charge: (kind: string, bytes: number) => void, timeoutMs: number, contract: RunContract = CONTRACT, checkpoint?: (process: OwnedProcess) => Promise<void>): Promise<OwnedProcess> {
  const child = fork(fileURLToPath(new URL('./child.ts', import.meta.url)), [], {
    execPath: process.execPath, execArgv: ['--import', 'tsx'],
    env: { PATH: process.env.PATH, ...(config.pgDelivery ? { NODE_DISABLE_COMPILE_CACHE: '1', TSX_DISABLE_CACHE: '1', TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP } : {}), TSX_TSCONFIG_PATH: typeof config.sourceDirectory === 'string' ? join(config.sourceDirectory, 'tsconfig.json') : fileURLToPath(new URL('./tsconfig.json', import.meta.url)) },
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
  try { await checkpoint?.(result); await transmit(result, config, charge, contract); result.ready = await ready.promise; return result; }
  finally { clearTimeout(timer); }
}
export async function transmit(owned: OwnedProcess, record: Record<string, unknown>, charge: (kind: string, bytes: number) => void, contract: RunContract = CONTRACT) {
  const bytes = Buffer.byteLength(JSON.stringify(record));
  if (bytes > contract.responseBytes) throw new Error('ipc_payload_too_large');
  charge('ipc-out', bytes);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ipc_send_timeout')), contract.requestMs);
    try { owned.child.send(record, error => { clearTimeout(timer); error ? reject(new Error('ipc_send_failed')) : resolve(); }); }
    catch { clearTimeout(timer); reject(new Error('ipc_send_failed')); }
  });
}
