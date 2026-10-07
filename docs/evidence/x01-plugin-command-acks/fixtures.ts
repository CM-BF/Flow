import { changed, id, response, uuid } from '../x01-cli-commands/fixtures.js';
export { id, response, uuid };
export const configure = { expectedRevision: 2, reason: ' configure ', change: { kind: 'configure' as const, values: { enabled: true, count: 3, mode: 'balanced' } } };
export const grant = { expectedRevision: 2, reason: 'grant tools', change: { kind: 'set-grants' as const, capabilities: ['context', 'tool'] as ('context' | 'tool')[] } };
export function configured() {
  const { runtime: _runtime, ...value } = changed();
  value.operation.kind = 'configure';
  value.snapshot.configuration = structuredClone(configure.change.values);
  Object.assign(value.snapshot.version, { capabilities: ['tool', 'context'], publicConfiguration: [
    { key: 'enabled', kind: 'boolean', required: true },
    { key: 'count', kind: 'integer', required: true, min: 1, max: 5 },
    { key: 'mode', kind: 'enum', required: false, values: ['balanced', 'fast'] },
  ] });
  return value;
}
export function granted() {
  const value = configured(); value.operation.kind = 'set-grants';
  value.snapshot.grants = ['context', 'tool']; value.snapshot.configuration = {}; value.snapshot.configurationStatus = 'incomplete';
  return value;
}
