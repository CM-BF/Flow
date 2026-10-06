import { expect, it } from 'vitest';
import { taskSubmissionSchema, registerRunnerSchema } from './index.js';
import { isAuthoritativeUsageAllowed } from './harnesses.js';

it('requires bounded endpoint configuration only for a2a work and allows the third registered harness', () => {
  const task = { title: 'Remote task', prompt: 'Perform work', harness: 'a2a', protocol: { endpointRef: 'research-peer' } };
  expect(taskSubmissionSchema.parse(task)).toEqual(task);
  for (const input of [{ ...task, protocol: undefined }, { ...task, harness: 'claude' }, { ...task, resumeSessionId: 'native-session' }, { ...task, protocol: { endpointRef: '../secret' } }]) {
    expect(taskSubmissionSchema.safeParse(input).success).toBe(false);
  }
  expect(registerRunnerSchema.parse({ name: 'Configured runtimes', harnesses: ['fixture', 'claude', 'a2a'] }).harnesses).toHaveLength(3);
  expect(registerRunnerSchema.safeParse({ name: 'Duplicate', harnesses: ['a2a', 'a2a'] }).success).toBe(false);
});

it('never assigns remote or unknown source usage to the Claude accounting policy', () => {
  const sample = { scope: 'session', source: 'claude.modelUsage', model: 'sonnet' };
  expect(isAuthoritativeUsageAllowed('claude', sample)).toBe(true);
  expect(isAuthoritativeUsageAllowed('a2a', sample)).toBe(false);
  expect(isAuthoritativeUsageAllowed('fixture', sample)).toBe(false);
  expect(isAuthoritativeUsageAllowed('claude', { ...sample, model: undefined })).toBe(false);
  expect(isAuthoritativeUsageAllowed('claude', { ...sample, source: 'untrusted' })).toBe(false);
  expect(isAuthoritativeUsageAllowed('fixture', { scope: 'session', source: 'fixture' })).toBe(true);
});

it('registers only the fixed Codex harness without borrowing authoritative usage', () => {
  expect(registerRunnerSchema.parse({ name: 'Codex', harnesses: ['codex'] }).harnesses).toEqual(['codex']);
  expect(registerRunnerSchema.safeParse({ name: 'Unknown', harnesses: ['codex-next'] }).success).toBe(false);
  expect(isAuthoritativeUsageAllowed('codex', { scope: 'session', source: 'claude.modelUsage', model: 'gpt-5.4' })).toBe(false);
  expect(isAuthoritativeUsageAllowed('codex', { scope: 'session', source: 'codex.tokenUsage', model: 'gpt-5.4' })).toBe(false);
});
