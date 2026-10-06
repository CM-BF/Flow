import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hooks = vi.hoisted(() => ({ base: '', roots: [] as string[], failure: '', rootNumber: 1, fired: false, listener: vi.fn() }));
vi.mock('node:net', () => ({ default: { createServer: hooks.listener } }));
vi.mock('node:fs', async importOriginal => {
  const real = await importOriginal<typeof import('node:fs')>();
  function fail(kind: string, file: string) {
    if (!hooks.fired && hooks.failure === kind && file === hooks.roots[hooks.rootNumber - 1]) {
      hooks.fired = true; throw Error('OWNED_PREPARATION_FAILURE');
    }
  }
  return { ...real, default: {
    ...real,
    readFileSync(file: string, ...args: any[]) {
      if (file.endsWith('/bootstrap-inspection.json')) return JSON.stringify({ nonSystemRuntimeHashes: {}, wrapperAndOSMetadataHashes: {} });
      if (file.endsWith('/r06-binding.json')) return JSON.stringify({ peerSha256: createHash('sha256').update('synthetic-unused-peer').digest('hex') });
      return (real.readFileSync as any)(file, ...args);
    },
    mkdtempSync(_prefix: string) {
      const created = real.mkdtempSync(path.join(hooks.base, 'root-')); hooks.roots.push(created); return created;
    },
    realpathSync(file: string) { fail('realpath', file); return real.realpathSync(file); },
    lstatSync(file: string) { fail('lstat', file); return real.lstatSync(file); },
    chmodSync(file: string, mode: number) { fail('chmod', file); return real.chmodSync(file, mode); },
  } };
});
import { runSyntheticCanary } from '../isolation/compose-canary.mjs';
const real = await vi.importActual<typeof import('node:fs')>('node:fs');
beforeEach(() => {
  hooks.base = real.mkdtempSync('/private/tmp/flow-compose-prep-test-'); hooks.roots = []; hooks.fired = false;
  hooks.listener.mockReset().mockImplementation(() => { throw Error('Listener creation forbidden'); });
});
afterEach(() => { real.rmSync(hooks.base, { recursive: true }); }); // Exact own fixture parent; no live child/listener.

test.each([
  ['realpath', 1], ['lstat', 1], ['chmod', 1],
  ['realpath', 2], ['lstat', 2], ['chmod', 2],
] as const)('%s failure for root %i retains every created path and never guesses an inode', async (failure, number) => {
  hooks.failure = failure; hooks.rootNumber = number;
  const factory = vi.fn(() => { throw Error('Child creation forbidden'); });
  const result = await runSyntheticCanary(factory, {
    r06Target: 'a239b14d5328c78cca02a8757e26f2b65502f926', peerBytes: Buffer.from('synthetic-unused-peer'),
  });
  expect(hooks.fired).toBe(true); expect(hooks.roots).toHaveLength(number);
  expect(result).toMatchObject({ passed: false, reason: 'cleanup-unconfirmed', listenerClosed: true, retainedRoots: hooks.roots });
  for (const directory of hooks.roots) expect(real.lstatSync(directory).isDirectory()).toBe(true);
  expect(factory).not.toHaveBeenCalled(); expect(hooks.listener).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain('OWNED_PREPARATION_FAILURE');
});
