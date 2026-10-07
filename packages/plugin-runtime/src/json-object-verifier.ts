import { jsonObjectRuleSchema, PLUGIN_VERIFICATION_LIMITS, type JsonObjectRule, type JsonObjectVerdict } from '../../contracts/src/plugin-verification.js';
import { isPersistablePluginText } from '../../contracts/src/plugin-runtime.js';

/** Fixed trusted algorithm. No package import, I/O, recursive schema language or verdict cache. */
export function verifyJsonObject(content: string, input: JsonObjectRule): JsonObjectVerdict {
  const rule = jsonObjectRuleSchema.parse(input);
  if (typeof content !== 'string' || content.length > PLUGIN_VERIFICATION_LIMITS.sourceBytes || !isPersistablePluginText(content)
    || new TextEncoder().encode(content).length > PLUGIN_VERIFICATION_LIMITS.sourceBytes) throw new Error('VERIFICATION_INPUT_TOO_LARGE_OR_INVALID');
  let value: unknown;
  try { value = JSON.parse(content); }
  catch { return { result: 'failed', reason: 'invalid-json', missingKeys: [] }; }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { result: 'failed', reason: 'not-object', missingKeys: [] };
  const missingKeys = rule.requiredKeys.filter(key => !Object.hasOwn(value, key));
  return missingKeys.length ? { result: 'failed', reason: 'missing-required-keys', missingKeys }
    : { result: 'passed', reason: 'passed', missingKeys: [] };
}
