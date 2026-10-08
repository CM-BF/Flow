import { lstatSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import type { HarnessContext } from '@flow/contracts';
import { executionProfileReferenceSchema, nativeExecutionProfileConfigurationJson, type CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { textDigest } from '../../verifier.js';
import { NativeExecutionError } from '../settlement.js';
import type { CodexTransportFactory } from './exchange.js';

const storageBrand = Symbol('host-owned-codex-storage');
export interface CodexSessionStorage { readonly [storageBrand]: true }
export type PersistentCodexTransportFactory = (options: Parameters<CodexTransportFactory>[0] & { readonly codeHome: string }) => ReturnType<CodexTransportFactory>;
interface StorageBinding {
  readonly codeHome: string;
  readonly runnerId: string;
  readonly configDigest: string;
  readonly identity: { dev: bigint; ino: bigint };
  readonly createTransport: PersistentCodexTransportFactory;
}
const bindings = new WeakMap<CodexSessionStorage, StorageBinding>();
function identity(codeHome: string) {
  const stat = lstatSync(codeHome, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077n) !== 0n
    || process.getuid === undefined || stat.uid !== BigInt(process.getuid())) throw new Error('Storage is unavailable.');
  return { dev: stat.dev, ino: stat.ino };
}
/** Trusted host input only. Reads directory metadata, never session/auth/config contents; ownership stays with the host. */
export function createCodexSessionStorage(options: {
  codeHome: string; runnerId: string; configDigest: string; createTransport: PersistentCodexTransportFactory;
}): CodexSessionStorage {
  try {
    if (!isAbsolute(options.codeHome) || normalize(options.codeHome) !== options.codeHome || typeof options.createTransport !== 'function') throw new Error();
    const runnerId = executionProfileReferenceSchema.shape.runnerId.parse(options.runnerId);
    const configDigest = executionProfileReferenceSchema.shape.configDigest.parse(options.configDigest);
    const binding = { codeHome: options.codeHome, runnerId, configDigest, identity: identity(options.codeHome), createTransport: options.createTransport };
    const handle: CodexSessionStorage = Object.freeze({ [storageBrand]: true as const });
    bindings.set(handle, binding);
    return handle;
  } catch { throw new Error('Host-owned Codex session storage is unavailable.'); }
}
export function assertCodexSessionStorage(storage: CodexSessionStorage | undefined, profile: CodexExecutionProfileConfiguration): void {
  const binding = storage && bindings.get(storage);
  if (!binding || profile.sessionPersistence !== 'host-owned' || binding.configDigest !== textDigest(nativeExecutionProfileConfigurationJson(profile))) {
    throw new Error('Host-owned Codex session storage does not match the configured profile.');
  }
}
/** Bind to the already fenced assignment; do not create another ownership or auth authority. */
export function sessionTransport(storage: CodexSessionStorage, profile: CodexExecutionProfileConfiguration, context: HarnessContext): CodexTransportFactory {
  assertCodexSessionStorage(storage, profile);
  const binding = bindings.get(storage)!;
  const pin = context.task.executionProfile;
  if (!pin || !context.executionIdentity || context.executionIdentity.runnerId !== binding.runnerId
    || pin.runnerId !== binding.runnerId || pin.configDigest !== binding.configDigest) throw new NativeExecutionError('settled');
  return options => {
    try {
      const current = identity(binding.codeHome);
      if (current.dev !== binding.identity.dev || current.ino !== binding.identity.ino) throw new Error();
    } catch { throw new NativeExecutionError('settled'); }
    return binding.createTransport({ ...options, codeHome: binding.codeHome });
  };
}
