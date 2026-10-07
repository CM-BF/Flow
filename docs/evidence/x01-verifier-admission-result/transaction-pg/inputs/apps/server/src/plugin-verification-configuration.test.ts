import { expect, test } from 'vitest';
import { assertTrustedVerifier, readPluginVerificationConfiguration, verifierPolicy } from './plugin-verification-configuration.js';
const material = { artifactSha256: 'a'.repeat(64), treeDigest: 'b'.repeat(64), hostApiMajor: 1 as const,
  algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const };
test('VAR private policy snapshots exact material and algorithm, never a name or store claim', () => {
  const input = { materials: [{ ...material }] }; const policy = verifierPolicy(input);
  input.materials[0]!.artifactSha256 = 'c'.repeat(64);
  expect(policy(material)).toBe(true);
  expect(policy({ ...material, treeDigest: 'c'.repeat(64) })).toBe(false);
  expect(() => assertTrustedVerifier(undefined, material)).toThrow();
  expect(() => verifierPolicy({ materials: [material, material] })).toThrow();
  expect(() => verifierPolicy({ materials: [{ ...material, algorithmVersion: 2 }] })).toThrow();
});
test('VAR private policy defaults off and explicit empty path fails closed', async () => {
  expect(await readPluginVerificationConfiguration(undefined)).toBeUndefined();
  await expect(readPluginVerificationConfiguration('')).rejects.toThrow('owned 0600');
});
