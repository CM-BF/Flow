import { createWriteStream } from 'node:fs';
import { invokeInstalledTool, invokeInstalledVerifier, PluginToolError, type PluginToolInput } from './host.js';
import { FrameReader, FrameWriter, sameIdentity, type ProcessFrame, type ProcessIdentity } from './process-protocol.js';

const signal = new AbortController(); const output = createWriteStream('', { fd: 3, autoClose: false });
let identity: ProcessIdentity | undefined, writer: FrameWriter | undefined, requested = 0;
let waiting: { sequence: number; resolve(): void; reject(error: unknown): void } | undefined;
async function request(value: Record<string, unknown>): Promise<void> {
  if (!writer || waiting) throw new Error('PROCESS_PROTOCOL_INVALID');
  const response = new Promise<void>((resolve, reject) => { waiting = { sequence: ++requested, resolve, reject }; });
  try { await writer.send(value); await response; } finally { waiting = undefined; }
}
function stop() { signal.abort(); waiting?.reject(new PluginToolError('OUTCOME_UNKNOWN')); }
async function execute(value: unknown, executionKind: 'tool' | 'verifier'): Promise<void> {
  try {
    const input = value as Omit<PluginToolInput, 'authorize' | 'assertOwnership' | 'signal'>;
    const invoke = executionKind === 'verifier' ? invokeInstalledVerifier : invokeInstalledTool;
    const result = await invoke({ ...input, signal: signal.signal,
      assertOwnership: () => request({ kind: 'check' }), authorize: (_, phase) => request({ kind: 'authorize', phase }) });
    await writer!.send({ kind: 'result', value: result });
  } catch (error) {
    const known = ['PACKAGE_FAILED', 'OUTCOME_UNKNOWN', 'CANCELLED', 'INVALID_INPUT', 'MATERIAL_MISMATCH', 'PACKAGE_KIND_MISMATCH', 'HOST_API_MISMATCH', 'OUTPUT_REJECTED'];
    await writer!.send({ kind: 'error', code: error instanceof PluginToolError && known.includes(error.code) ? error.code : 'PACKAGE_FAILED' }).catch(() => {});
  } finally { output.end(() => process.exit(0)); }
}
function accept(frame: ProcessFrame) {
  if (!identity) {
    if (frame.kind !== 'init') throw new Error('PROCESS_INIT_REQUIRED'); identity = frame.identity; writer = new FrameWriter(output, identity);
    void execute(frame.value, frame.executionKind); return;
  }
  if (!sameIdentity(frame.identity, identity)) throw new Error('PROCESS_IDENTITY_INVALID');
  if (frame.kind === 'abort') { stop(); return; }
  if (frame.kind !== 'ack' || !waiting || frame.request !== waiting.sequence) throw new Error('PROCESS_ACK_INVALID');
  if (frame.ok) waiting.resolve(); else waiting.reject(new PluginToolError('OUTCOME_UNKNOWN'));
}
const reader = new FrameReader(192 * 1024, accept);
process.stdin.on('data', chunk => { try { reader.push(chunk); } catch { stop(); process.exitCode = 1; process.stdin.destroy(); output.end(); } });
process.stdin.on('end', () => { try { reader.end(); } catch { process.exitCode = 1; } stop(); });
process.stdin.on('error', stop); output.on('error', stop);
