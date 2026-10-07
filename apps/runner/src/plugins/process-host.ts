import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import { PluginToolError, type PluginToolInput, type PluginToolResult } from './host.js';
import { FrameReader, FrameWriter, sameIdentity, type ProcessFrame, type ProcessIdentity } from './process-protocol.js';
import { ProcessResources } from './process-resources.js';

export interface ProcessObservation { pid: number | undefined; exitCode: number | null; signal: string | null; protocolEof: boolean;
  stdoutEof: boolean; stderrEof: boolean; diagnosticBytes: number; processClosed: boolean }
const resultSchema = z.strictObject({ kind: z.literal('text'), content: z.string(), provenance: z.strictObject({ bindingId: z.uuid(),
  invocationId: z.uuid(), taskId: z.uuid(), attemptId: z.uuid(), ownerVersion: z.number().int().positive(), installationId: z.string(),
  artifactId: z.uuid(), artifactSha256: z.string(), treeDigest: z.string(), hostApiMajor: z.literal(1) }) });

/** Explicit trusted mode. No token, arbitrary executable, current directory loader, or OS sandbox promise. */
export async function createTrustedProcessHost(options: { resourceRoot: string; observe?: (fact: ProcessObservation) => void }) {
  const loader = createRequire(import.meta.url).resolve('tsx');
  const worker = fileURLToPath(new URL('./process-worker.ts', import.meta.url));
  const resources = await ProcessResources.open(options.resourceRoot);
  return { invoke: (input: PluginToolInput) => invoke(input), close: () => resources.close() };

  async function invoke(original: PluginToolInput): Promise<PluginToolResult> {
    const input: PluginToolInput = { ...original, binding: structuredClone(original.binding), store: { ...original.store, allowedDigests: [...original.store.allowedDigests] } };
    if (input.signal.aborted) throw new PluginToolError('CANCELLED');
    if (!input.store.allowedDigests.includes(input.binding.material.artifact.sha256)) throw new PluginToolError('MATERIAL_MISMATCH');
    const identity: ProcessIdentity = { nonce: randomBytes(16).toString('hex'), bindingId: input.binding.bindingId,
      invocationId: input.binding.invocationId, taskId: input.binding.taskId, attemptId: input.binding.attemptId, ownerVersion: input.binding.ownerVersion };
    const item = await resources.reserve(identity);
    let first: unknown, failed = false, settlementUnknown = false, stopping = false, signalUnknown = false, checks = 0, authorizations = 0, busy = false;
    let result: PluginToolResult | undefined, response = false, protocolEof = false, stdoutEof = false, stderrEof = false;
    let diagnosticBytes = 0, exitCode: number | null = null, exitSignal: string | null = null, closed = false;
    let term: ReturnType<typeof setTimeout> | undefined, final: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(process.execPath, ['--import', loader, worker], { cwd: item.scratch,
      env: { PATH: '/usr/bin:/bin', LANG: 'C', HOME: item.scratch, TMPDIR: item.scratch, NODE_DISABLE_COMPILE_CACHE: '1', TSX_DISABLE_CACHE: '1' },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'], shell: false });
    const pipe = child.stdio[3] as Readable; const writer = new FrameWriter(child.stdin!, identity);
    let finishWait!: () => void; const finished = new Promise<void>(resolve => { finishWait = resolve; });
    function remember(error: unknown) {
      if (error instanceof PluginToolError && error.code === 'OUTCOME_UNKNOWN') settlementUnknown = true;
      if (!failed) { failed = true; first = error; }
    }
    function kill(signal: NodeJS.Signals) {
      if (closed || child.exitCode !== null || child.signalCode !== null) return;
      try { if (!child.kill(signal)) signalUnknown = true; } catch { signalUnknown = true; }
    }
    function stop(error: unknown) {
      remember(error); if (stopping) return; stopping = true;
      void writer.send({ kind: 'abort' }).catch(() => {}); kill('SIGTERM');
      term = setTimeout(() => kill('SIGKILL'), 1000);
      final = setTimeout(() => { if (!closed) { signalUnknown = true; resources.keep(); } finishWait(); }, 2000);
    }
    const abort = () => stop(new PluginToolError('OUTCOME_UNKNOWN'));
    const deadline = setTimeout(abort, 10_000); input.signal.addEventListener('abort', abort, { once: true });
    child.on('error', error => stop(error)); child.stdin!.on('error', () => { if (!stopping && !response) stop(new PluginToolError('OUTCOME_UNKNOWN')); });
    child.on('close', (code, signal) => { closed = true; exitCode = code; exitSignal = signal; finishWait(); });
    const count = (chunk: Buffer) => { diagnosticBytes += chunk.length; if (diagnosticBytes > 16384) stop(new PluginToolError('OUTCOME_UNKNOWN')); };
    // Intentionally discard body bytes: even a small console message can contain input/configuration.
    child.stdout!.on('data', count); child.stderr!.on('data', count);
    child.stdout!.on('end', () => { stdoutEof = true; }); child.stderr!.on('end', () => { stderrEof = true; });
    for (const stream of [child.stdout!, child.stderr!, pipe]) stream.on('error', () => stop(new PluginToolError('OUTCOME_UNKNOWN')));
    const reader = new FrameReader(128 * 1024, frame => {
      if (!sameIdentity(identity, frame.identity) || busy || response || stopping) throw new Error('PROCESS_PROTOCOL_INVALID');
      if (frame.kind === 'check' || frame.kind === 'authorize') {
        busy = true;
        void handle(frame).catch(error => stop(error)).finally(() => { busy = false; });
      } else if (frame.kind === 'result') {
        if (checks !== 5 || authorizations !== 2) throw new Error('PROCESS_PHASE_INVALID');
        const parsed = resultSchema.parse(frame.value), p = parsed.provenance, b = input.binding;
        if (Buffer.byteLength(parsed.content) > 16384 || p.bindingId !== b.bindingId || p.invocationId !== b.invocationId || p.taskId !== b.taskId
          || p.attemptId !== b.attemptId || p.ownerVersion !== b.ownerVersion || p.installationId !== b.material.installationId
          || p.artifactId !== b.material.artifact.artifactId || p.artifactSha256 !== b.material.artifact.sha256 || p.treeDigest !== b.material.treeDigest) throw new Error('PROCESS_RESULT_INVALID');
        result = parsed; response = true;
      } else if (frame.kind === 'error') { response = true; remember(new PluginToolError(frame.code)); }
      else throw new Error('PROCESS_PROTOCOL_INVALID');
    });
    pipe.on('data', chunk => { try { reader.push(chunk); } catch { stop(new PluginToolError('OUTCOME_UNKNOWN')); } });
    pipe.on('end', () => { protocolEof = true; try { reader.end(); } catch { stop(new PluginToolError('OUTCOME_UNKNOWN')); } });
    async function handle(frame: Extract<ProcessFrame, { kind: 'check' | 'authorize' }>) {
      if (input.signal.aborted) throw new PluginToolError('OUTCOME_UNKNOWN');
      if (frame.kind === 'check') {
        const expectedAuth = [0, 1, 1, 2, 2][checks];
        if (expectedAuth === undefined || authorizations !== expectedAuth) throw new PluginToolError('OUTCOME_UNKNOWN');
        checks++; await input.assertOwnership();
      } else {
        if (frame.phase !== (authorizations === 0 ? 'load' : 'invoke') || checks !== (authorizations === 0 ? 1 : 3) || authorizations >= 2) throw new PluginToolError('OUTCOME_UNKNOWN');
        authorizations++; await input.assertOwnership(); await input.authorize(input.binding, frame.phase); await input.assertOwnership();
      }
      if (input.signal.aborted || stopping) throw new PluginToolError('OUTCOME_UNKNOWN');
      await writer.send({ kind: 'ack', request: frame.sequence, ok: true });
    }
    try {
      if (!child.pid) throw new PluginToolError('OUTCOME_UNKNOWN');
      await resources.update(item, { state: 'spawned', childPid: child.pid, spawnedAt: new Date().toISOString() });
      if (input.signal.aborted) abort();
      else await writer.send({ kind: 'init', value: { store: { ...input.store, allowedDigests: [input.binding.material.artifact.sha256] }, binding: input.binding, input: input.input } });
      await finished;
      if (!closed || !protocolEof || !stdoutEof || !stderrEof || signalUnknown
        || !response && !failed || response && exitCode !== 0) remember(new PluginToolError('OUTCOME_UNKNOWN'));
      if (!failed) { await input.assertOwnership(); if (input.signal.aborted) remember(new PluginToolError('OUTCOME_UNKNOWN')); }
    } catch (error) { stop(error); await finished; }
    finally {
      clearTimeout(deadline); clearTimeout(term); clearTimeout(final); input.signal.removeEventListener('abort', abort);
      const processClosed = closed && protocolEof && stdoutEof && stderrEof && !signalUnknown;
      try { options.observe?.({ pid: child.pid, exitCode, signal: exitSignal, protocolEof, stdoutEof, stderrEof, diagnosticBytes, processClosed }); }
      catch { remember(new PluginToolError('OUTCOME_UNKNOWN')); }
      if (processClosed) { try { await resources.finish(item); } catch { remember(new PluginToolError('OUTCOME_UNKNOWN')); resources.keep(); } }
      else { resources.keep(); remember(new PluginToolError('OUTCOME_UNKNOWN')); }
    }
    if (settlementUnknown) {
      // A known plugin/authorization failure cannot certify later process or resource settlement.
      if (first instanceof PluginToolError && first.code === 'OUTCOME_UNKNOWN') throw first;
      const unknown = new PluginToolError('OUTCOME_UNKNOWN');
      if (failed) Object.defineProperty(unknown, 'cause', { value: first, configurable: true });
      throw unknown;
    }
    if (failed) throw first;
    if (!result) throw new PluginToolError('OUTCOME_UNKNOWN'); return result;
  }
}
