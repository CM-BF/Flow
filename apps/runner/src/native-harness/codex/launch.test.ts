import { expect, it, vi } from 'vitest';
import { configureCodexLaunch } from './launch.js';

const profile = { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model',
  reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
  hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } };

it('constructs an immutable ordinary harness using an explicit factory without native I/O', () => {
  const createTransport = vi.fn(() => { throw new Error('Construction must not launch a process.'); });
  const configured = configureCodexLaunch(profile, createTransport);
  expect(configured.adapter.name).toBe('codex');
  expect(configured.descriptor.publicProfile).toEqual(profile);
  expect(configured.descriptor.ports).toEqual({});
  expect(Object.isFrozen(configured.descriptor.publicProfile)).toBe(true);
  expect(Object.isFrozen(configured.descriptor.publicProfile.hostLimits)).toBe(true);
  expect(createTransport).not.toHaveBeenCalled();
});

it('has no default executable or self-authorized launch recipe', () => {
  expect(() => configureCodexLaunch(profile)).toThrow('A trusted Codex launch factory is unavailable.');
});

it.each(['executable', 'args', 'env', 'approved', 'query', 'resume', 'launch'])('rejects untrusted %s rather than converting JSON into native launch authority', key => {
  const createTransport = vi.fn(() => { throw new Error('Unexpected launch'); });
  expect(() => configureCodexLaunch({ ...profile, [key]: true }, createTransport)).toThrow();
  expect(createTransport).not.toHaveBeenCalled();
});

it('rejects unsupported versions and permissions before invoking a trusted dependency', () => {
  const createTransport = vi.fn(() => { throw new Error('Unexpected launch'); });
  for (const change of [{ adapterVersion: 'latest' }, { access: 'configured-readonly' }, { approvalPolicy: 'on-request' }, { sandboxMode: 'workspace-write' }]) {
    expect(() => configureCodexLaunch({ ...profile, ...change }, createTransport)).toThrow();
  }
  expect(createTransport).not.toHaveBeenCalled();
});
