import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { HarnessAdapter } from '@flow/contracts';
import { createFixtureAdapter } from './fixture.js';
import { createClaudeAdapter, type ClaudeAdapterOptions } from './claude.js';

/** An explicit operator manifest enables Claude; omission preserves fixture-only startup. */
export async function loadRunnerAdapters(manifestFile?: string): Promise<HarnessAdapter[]> {
  const adapters = [createFixtureAdapter()];
  if (!manifestFile) return adapters;
  if (!isAbsolute(manifestFile) || (await stat(manifestFile)).size > 16_384) throw new Error('Claude manifest must be a small, explicitly selected absolute file.');
  const content = await readFile(manifestFile, 'utf8');
  if (Buffer.byteLength(content) > 16_384) throw new Error('Claude manifest exceeds its size limit.');
  adapters.push(createClaudeAdapter(parseManifest(JSON.parse(content))));
  return adapters;
}

function parseManifest(value: unknown): ClaudeAdapterOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Claude manifest must be an object.');
  const config = value as Record<string, unknown>;
  const fields = ['materialFiles', 'model', 'allowRead', 'requireReadApproval', 'maxTurns', 'maxBudgetUsd', 'timeoutMs'];
  if (Object.keys(config).some(key => !fields.includes(key))) throw new Error('Claude manifest contains an unsupported field.');
  if (!Array.isArray(config.materialFiles) || config.materialFiles.length > 32 || config.materialFiles.some(file => typeof file !== 'string' || !isAbsolute(file))) throw new Error('Claude materialFiles must explicitly list at most 32 absolute paths.');
  if (config.model !== undefined && (typeof config.model !== 'string' || config.model.length === 0 || config.model.length > 180)) throw new Error('Invalid Claude model.');
  for (const field of ['allowRead', 'requireReadApproval']) if (config[field] !== undefined && typeof config[field] !== 'boolean') throw new Error('Invalid Claude read policy.');
  for (const field of ['maxTurns', 'maxBudgetUsd', 'timeoutMs']) if (config[field] !== undefined && typeof config[field] !== 'number') throw new Error('Invalid Claude execution limit.');
  return config as unknown as ClaudeAdapterOptions;
}
