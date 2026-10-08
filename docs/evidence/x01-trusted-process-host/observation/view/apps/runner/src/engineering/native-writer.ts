import { isDeepStrictEqual } from 'node:util';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import type { HarnessContext } from '@flow/contracts';
import type { EngineeringWriter } from './writer.js';
import { calculatorExecutionIdentitySchema } from './calculator-receipt.js';
import { createNativeFileRecipe, nativeEngineeringModelSchema, type NativeEngineeringModel } from './native-policy.js';
import { runCodexExchange, type CodexTransportFactory } from '../native-harness/codex/exchange.js';
import { NativeExecutionError } from '../native-harness/settlement.js';

const bindingSchema = z.strictObject({ identity: calculatorExecutionIdentitySchema, leaseId: z.uuid(),
  directory: z.string().min(1).max(4096).refine(isAbsolute), baseCommit: z.string().regex(/^[a-f0-9]{40}$/), model: nativeEngineeringModelSchema });
export type NativeWriteBinding = Readonly<z.infer<typeof bindingSchema>>;
/** Trusted host implementation only. No production implementation exists in this slice.
 * open must enforce the bound model/no-fallback and write policy before exposing a transport.
 * close owns bounded revocation of ALL delegated writers, even when open rejects midway. */
export interface NativeWriteAuthority {
  open(binding: NativeWriteBinding, signal: AbortSignal): Promise<{
    binding: NativeWriteBinding; policy: 'calculator-file-only-v1'; modelAssurance: 'locked-no-fallback'; createTransport: CodexTransportFactory;
  }>;
  close(binding: NativeWriteBinding, signal: AbortSignal): Promise<{ binding: NativeWriteBinding; writeAccess: 'revoked' | 'unknown' }>;
}
type Context = Pick<HarnessContext, 'executionIdentity' | 'signal' | 'assertOwnership'>;
/** A late authority response cannot settle this attempt. The authority still owns unfinished revocation. */
function bounded<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(Error('Native authority outcome is unknown.'));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Per-assignment private consumer. Never registered under the fixture v1 profile or ordinary native profile. */
export function createCodexEngineeringWriter(context: Context, model: NativeEngineeringModel, authority?: NativeWriteAuthority,
  wallTimeMs = 30_000): EngineeringWriter {
  if (!authority) throw Error('Native engineering authority is unavailable.');
  const identity = Object.freeze(calculatorExecutionIdentitySchema.parse(context.executionIdentity));
  const selectedModel = nativeEngineeringModelSchema.parse(model);
  if (!Number.isSafeInteger(wallTimeMs) || wallTimeMs < 1 || wallTimeMs > 60_000) throw Error('Native engineering time bound is invalid.');
  let invoked = false;
  return { async execute(input) {
    if (invoked) return { leaseId: input.leaseId, settlement: 'unknown' };
    invoked = true;
    if (typeof input.prompt !== 'string' || Buffer.byteLength(input.prompt) > 65_536) return { leaseId: input.leaseId, settlement: 'unknown' };
    let binding: NativeWriteBinding;
    try { binding = Object.freeze({ ...bindingSchema.parse({ identity, model: selectedModel,
      leaseId: input.leaseId, directory: input.directory, baseCommit: input.baseCommit }), identity }); }
    catch { return { leaseId: input.leaseId, settlement: 'unknown' }; }
    const deadline = new AbortController(), timer = setTimeout(() => deadline.abort(), wallTimeMs);
    const signal = AbortSignal.any([context.signal, input.signal, deadline.signal]);
    let validGrant = false, outcome: 'completed' | 'failed' | undefined, revoked = false;
    const ownership = async () => { signal.throwIfAborted(); await bounded(context.assertOwnership(), signal); await bounded(input.assertOwnership(), signal); signal.throwIfAborted(); };
    try {
      await ownership();
      const grant = await bounded(authority.open(binding, signal), signal);
      if (!isDeepStrictEqual(bindingSchema.parse(grant.binding), binding) || grant.policy !== 'calculator-file-only-v1'
        || grant.modelAssurance !== 'locked-no-fallback' || typeof grant.createTransport !== 'function') throw Error('Native grant differs.');
      validGrant = true; await ownership();
      try {
        await runCodexExchange(grant.createTransport, { workingDirectory: binding.directory, signal, assertOwnership: ownership },
          { wallTimeMs, maxOutputBytes: 16_384 }, createNativeFileRecipe(selectedModel, binding.directory, input.prompt));
        await ownership(); outcome = 'completed';
      } catch (error) { if (error instanceof NativeExecutionError && error.settlement === 'settled') outcome = 'failed'; }
    } catch { /* Unknown qualification/open/ownership cannot claim external work has stopped. */ }
    finally {
      clearTimeout(timer);
      const closing = new AbortController(), closeTimer = setTimeout(() => closing.abort(), wallTimeMs);
      try {
        const close = await bounded(authority.close(binding, closing.signal), closing.signal);
        revoked = close.writeAccess === 'revoked' && isDeepStrictEqual(bindingSchema.parse(close.binding), binding);
      } catch { revoked = false; }
      finally { clearTimeout(closeTimer); }
    }
    return validGrant && revoked && outcome
      ? { leaseId: input.leaseId, settlement: 'stopped', outcome }
      : { leaseId: input.leaseId, settlement: 'unknown' };
  } };
}
