import type { HarnessAdapter } from '@flow/contracts';
import { isAbsolute } from 'node:path';
import { executionProfileConfigurationSchema, claudeTurnSettingsConfigurationSchema, type ExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
import { createClaudeAdapter, type ClaudeAdapterOptions } from '../claude.js';
import { textDigest } from '../verifier.js';
import { describeNativeHarness } from './descriptor.js';

/** Interpret only the existing trusted operator manifest; no native query is started. */
export function configureClaudeHarness(value: unknown) {
  const { activeSteering = false, ...options } = parseManifest(value);
  const adapter = createClaudeAdapter(options);
  return describeNativeHarness(adapter, describeClaudeExecutionProfile(options, adapter, activeSteering));
}

/** Describe the fixed adapter settings without exposing its private authorized material paths. */
export function describeClaudeExecutionProfile(options: ClaudeAdapterOptions, adapter: HarnessAdapter, activeSteering = false): ExecutionProfileConfiguration {
  const files = options.allowRead === false ? [] : [...options.materialFiles];
  return executionProfileConfigurationSchema.parse({
    ...(activeSteering ? { activeSteering: { protocol: 'flow.active-steering.v1' } } : {}),
    ...(options.turnSettings ? { turnSettings: options.turnSettings } : {}),
    harness: adapter.name, adapterVersion: adapter.version, model: options.model ?? 'sonnet',
    thinking: 'disabled', permissionMode: 'dontAsk', access: options.goalTools ? 'goal-tools' : options.goalGraphTools ? 'goal-graph-tools' : files.length ? 'configured-readonly' : 'none',
    requireReadApproval: options.requireReadApproval ?? false, materialScopeDigest: textDigest(JSON.stringify(files)),
    limits: { maxTurns: options.maxTurns ?? 4, maxBudgetUsd: options.maxBudgetUsd ?? 1, timeoutMs: options.timeoutMs ?? 90_000 },
  });
}

function parseManifest(value: unknown): ClaudeAdapterOptions & { activeSteering?: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Claude manifest must be an object.');
  const config = value as Record<string, unknown>;
  const fields = ['materialFiles', 'turnSettings', 'activeSteering', 'goalTools', 'goalGraphTools', 'model', 'allowRead', 'requireReadApproval', 'maxTurns', 'maxBudgetUsd', 'timeoutMs'];
  if (Object.keys(config).some(key => !fields.includes(key))) throw new Error('Claude manifest contains an unsupported field.');
  if (!Array.isArray(config.materialFiles) || config.materialFiles.length > 32 || config.materialFiles.some(file => typeof file !== 'string' || !isAbsolute(file))) throw new Error('Claude materialFiles must explicitly list at most 32 absolute paths.');
  if (config.model !== undefined && (typeof config.model !== 'string' || config.model.length === 0 || config.model.length > 180)) throw new Error('Invalid Claude model.');
  for (const field of ['activeSteering', 'allowRead', 'requireReadApproval', 'goalTools', 'goalGraphTools']) if (config[field] !== undefined && typeof config[field] !== 'boolean') throw new Error('Invalid Claude read policy.');
  for (const field of ['maxTurns', 'maxBudgetUsd', 'timeoutMs']) if (config[field] !== undefined && typeof config[field] !== 'number') throw new Error('Invalid Claude execution limit.');
  return { ...config, ...(config.turnSettings !== undefined ? { turnSettings: claudeTurnSettingsConfigurationSchema.parse(config.turnSettings) } : {}) } as unknown as ClaudeAdapterOptions;
}
