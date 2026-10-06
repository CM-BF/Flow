import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { engineeringProfileConfigurationJson, type EngineeringProfileConfiguration } from '../../../../packages/contracts/src/engineering-profile.js';
import { digest } from './resources.js';
const dependencies = vi.hoisted(() => ({ prepare: vi.fn(), publish: vi.fn(), bind: vi.fn() }));
vi.mock('./setup.js', () => ({ prepareEngineeringSetup: dependencies.prepare }));
vi.mock('@flow/client', () => ({ FlowClient: class { publishEngineeringProfile = dependencies.publish; } }));
import { loadEngineeringRunner } from './launch.js';
const configuration: EngineeringProfileConfiguration = { protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1', purpose: 'engineering-fixture', recipe: 'calculator-v1',
  project: { id: 'project', baseCommit: 'a'.repeat(40) }, checker: { id: 'checker', version: '1', baselineDigest: 'b'.repeat(64) }, limits: { checkerTimeoutMs: 1000 } };
const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: digest(engineeringProfileConfigurationJson(configuration)) };
const options = { baseUrl: 'http://synthetic.invalid', token: 'synthetic', workingDirectory: '/trusted/host', manifestFile: '/trusted/manifest' };
beforeEach(() => {
  vi.resetAllMocks(); dependencies.prepare.mockResolvedValue({ configuration, bind: dependencies.bind });
  dependencies.publish.mockResolvedValue({ profile: { configuration, reference }, replayed: false }); dependencies.bind.mockResolvedValue({ name: 'fixture', version: 'engineering-1' });
});
it('publishes the strict local configuration once then binds its confirmed identity', async () => {
  expect(await loadEngineeringRunner(options)).toEqual({ name: 'fixture', version: 'engineering-1' });
  expect(dependencies.prepare).toHaveBeenCalledWith(options.workingDirectory, options.manifestFile);
  expect(dependencies.publish).toHaveBeenCalledExactlyOnceWith({ configuration }, expect.any(AbortSignal));
  expect(dependencies.bind).toHaveBeenCalledExactlyOnceWith(reference);
});
it.each(['configuration', 'digest'] as const)('refuses altered %s before binding local storage', async changed => {
  dependencies.publish.mockResolvedValue({ profile: { configuration: changed === 'configuration' ? { ...configuration, project: { ...configuration.project, id: 'changed' } } : configuration,
    reference: changed === 'digest' ? { ...reference, configDigest: 'c'.repeat(64) } : reference } });
  await expect(loadEngineeringRunner(options)).rejects.toThrow('did not confirm'); expect(dependencies.bind).not.toHaveBeenCalled();
});
it('does not turn a lost publication acknowledgement into a local pin', async () => {
  dependencies.publish.mockRejectedValue(new Error('lost acknowledgement'));
  await expect(loadEngineeringRunner(options)).rejects.toThrow('lost acknowledgement'); expect(dependencies.bind).not.toHaveBeenCalled();
});
it('honors cancellation before preparation and after publication without starting the host', async () => {
  const early = new AbortController(); early.abort();
  await expect(loadEngineeringRunner({ ...options, signal: early.signal })).rejects.toThrow(); expect(dependencies.prepare).not.toHaveBeenCalled();
  const late = new AbortController(); dependencies.publish.mockImplementation(async () => { late.abort(); return { profile: { configuration, reference } }; });
  await expect(loadEngineeringRunner({ ...options, signal: late.signal })).rejects.toThrow(); expect(dependencies.bind).not.toHaveBeenCalled();
});
