import { join } from 'node:path';
import type { CodexTransportFactory } from '../native-harness/codex/exchange.js';
import { prepareDarwinReadOnlyHost, type DarwinReadOnlyHost, type DarwinReadOnlyHostInput, type DarwinWriterStop } from './native-authority.js';
import { createNativeToolRecipe } from './native-tool-policy.js';
import type { NativeEngineeringModel } from './native-policy.js';
import { createTrustedToolWriter, openCalculatorToolFile, type CalculatorToolFile, type HostToolClose, type TrustedToolBinding, type TrustedToolWriter } from './native-tool-writer.js';

export interface TrustedToolHostStop extends HostToolClose {
  readonly child: DarwinWriterStop['child'];
}
/** Trusted dependency ports, never task JSON. Replacements must preserve real I/O settlement. */
export interface TrustedToolHostPorts {
  prepareNative(input: DarwinReadOnlyHostInput): Promise<DarwinReadOnlyHost>;
  openTarget(directory: string): Promise<CalculatorToolFile>;
}
export class TrustedToolHostPreparationError extends Error {
  constructor(readonly close: (signal: AbortSignal) => Promise<TrustedToolHostStop>) {
    super('Trusted tool host preparation failed; observe retained cleanup before releasing resources.');
    this.name = 'TrustedToolHostPreparationError';
  }
}

/** Compose one read-only native launch with the host's existing single-file gate.
 * This owns no turn, receive loop, lease release, NativeWriteAuthority or model qualification. */
export async function prepareTrustedToolHost(options: DarwinReadOnlyHostInput & {
  binding: TrustedToolBinding; model: NativeEngineeringModel; prompt: string; signal: AbortSignal;
  assertOwnership(binding: TrustedToolBinding): Promise<void>;
}, ports: TrustedToolHostPorts = { prepareNative: prepareDarwinReadOnlyHost, openTarget: openCalculatorToolFile }) {
  // Freeze caller data before any await; the gate performs the authoritative strict binding validation.
  const binding = Object.freeze({ ...options.binding, identity: Object.freeze({ ...options.binding.identity }) });
  const { directory, runtimeDirectory, startupRecipe, privateStderr, model, prompt, signal, assertOwnership } = options;
  let native: DarwinReadOnlyHost | undefined, target: CalculatorToolFile | undefined, writer: TrustedToolWriter | undefined;
  let stopped = false, uncertain = false, attempted = false;
  let closing: Promise<TrustedToolHostStop> | undefined;
  const stopNative = new AbortController();
  const neverAborted = new AbortController().signal;
  async function checkOwnership() {
    signal.throwIfAborted();
    if (stopped) throw Error('Trusted host admission sealed.');
    await assertOwnership(binding);
    signal.throwIfAborted();
    if (stopped) throw Error('Trusted host admission sealed.');
  }
  function beginClose(): Promise<TrustedToolHostStop> {
    stopped = true;
    writer?.seal(); // Before either asynchronous close; late ownership cannot reopen the file gate.
    stopNative.abort();
    closing ??= (async () => {
      const child = (async (): Promise<DarwinWriterStop['child']> => {
        try { return native ? (await native.close()).child : 'not-started'; } catch { return 'unconfirmed'; }
      })();
      const file = (async (): Promise<HostToolClose['hostWrite']> => {
        try {
          if (writer) return (await writer.close(neverAborted)).hostWrite;
          await target?.close();
          return 'settled';
        } catch { return 'unknown'; }
      })();
      const [childState, hostWrite] = await Promise.all([child, file]);
      return { child: childState, hostWrite, nativeWriteAccess: 'unknown' } as const;
    })();
    return closing;
  }
  function close(observation: AbortSignal): Promise<TrustedToolHostStop> {
    const actual = beginClose(); // Always retain and drain actual effects even if this observation times out.
    return new Promise(resolve => {
      const abort = () => { uncertain = true; resolve({ child: 'unconfirmed', hostWrite: 'unknown', nativeWriteAccess: 'unknown' }); };
      observation.addEventListener('abort', abort, { once: true });
      if (observation.aborted) abort();
      actual.then(result => {
        observation.removeEventListener('abort', abort);
        resolve({ ...result, hostWrite: uncertain ? 'unknown' : result.hostWrite });
      });
    });
  }
  try {
    await checkOwnership();
    native = await ports.prepareNative({ directory, runtimeDirectory, startupRecipe, ...(privateStderr === undefined ? {} : { privateStderr }) });
    await checkOwnership();
    target = await ports.openTarget(directory);
    if (target.identity.path !== join(directory, 'calculator.mjs')) throw Error('Trusted tool target differs.');
    writer = createTrustedToolWriter({ binding, target, signal, assertOwnership });
    const recipe = createNativeToolRecipe({ model, cwd: directory, prompt, writer });
    await checkOwnership();
    const createTransport: CodexTransportFactory = input => {
      if (stopped || attempted) throw Error('Trusted host launch consumed.');
      attempted = true;
      if (input.workingDirectory !== directory) throw Error('Trusted host launch rejected.');
      const launchSignal = AbortSignal.any([signal, input.signal, stopNative.signal]);
      launchSignal.throwIfAborted();
      return native!.createTransport({ ...input, signal: launchSignal });
    };
    return Object.freeze({ policySha256: native.policySha256, targetIdentity: target.identity, createTransport, recipe, close });
  } catch {
    // Cleanup may be unbounded in an injected/unresponsive port. Start it once and return its observation handle.
    void beginClose();
    throw new TrustedToolHostPreparationError(close);
  }
}
