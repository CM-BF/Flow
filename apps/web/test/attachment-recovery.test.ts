import { describe, expect, it } from 'vitest';
import { createRecoveryJournal, recoveryUploadMatches, type RecoveryIdentity } from '../src/attachments/recovery';
const id: RecoveryIdentity = { key: 'original-key', scope: '10000000-0000-4000-8000-000000000001', projectId: 'project-a', name: 'note.txt', mediaType: 'text/plain', byteLength: 3, contentDigest: 'a'.repeat(64) };
const resource = { reference: { kind: 'upload' as const, projectId: id.projectId, resourceId: '20000000-0000-4000-8000-000000000001', version: 1 as const, contentDigest: id.contentDigest }, name: id.name, mediaType: 'text/plain' as const, byteLength: 3, createdAt: '2026-10-06T00:00:00Z', expiresAt: '2026-10-07T00:00:00Z', state: 'ready' as const, retained: false };
const receipt = { uploadKey: id.key, recoveryScopeId: id.scope, requestDigest: 'b'.repeat(64), resource };
function storage() { let raw: string | null = null; return { read: () => raw, write: (value: string) => { raw = value; } }; }
describe('bounded upload recovery metadata', () => {
  it('persists original identity across journal reconstruction, without text or credentials', () => {
    const store = storage(), first = createRecoveryJournal(store); first.begin(id);
    const restored = createRecoveryJournal(store); expect(restored.list()).toEqual([{ ...id, state: 'unknown' }]);
    expect(() => restored.forget(id.key)).toThrow(/unknown/); expect(store.read()).not.toContain('text":');
    expect(restored.begin({ ...id })).toEqual(restored.list()[0]); expect(() => restored.begin({ ...id, name: 'different.txt' })).toThrow(/original/);
  });
  it('checks ordered receipt identity, preserves first identity while current expires or becomes unavailable', () => {
    const journal = createRecoveryJournal(storage()); journal.begin(id);
    expect(() => journal.accepted(id, { ...receipt, uploadKey: 'different' })).toThrow(/original/);
    const saved = journal.accepted(id, receipt); resource.name = 'mutated.txt';
    expect(saved.resource?.name).toBe('note.txt'); resource.name = 'note.txt'; expect(Object.isFrozen(saved.resource?.reference)).toBe(true);
    expect(journal.observed(id, { receipt, current: { state: 'expired', retained: true } }).state).toBe('expired');
    expect(journal.observed(id, { receipt, current: { state: 'unavailable', retained: null } }).resource?.reference).toEqual(resource.reference);
  });
  it('does not evict unknown entries and fails before storage or body dispatch when full', () => {
    const journal = createRecoveryJournal(storage()); for (let n = 0; n < 16; n++) journal.begin({ ...id, key: `key-${n}` });
    expect(() => journal.begin(id)).toThrow(/full/); expect(journal.list()).toHaveLength(16);
    const denied = createRecoveryJournal({ read: () => null, write: () => { throw Error('quota denied'); } }); expect(() => denied.begin(id)).toThrow('quota denied');
  });
  it('does not erase corrupt or cross-key data and checks full reselected metadata', () => {
    const store = storage(); store.write('{bad'); const journal = createRecoveryJournal(store); expect(() => journal.list()).toThrow(); expect(store.read()).toBe('{bad');
    const upload = { recoveryScopeId: id.scope, name: id.name, mediaType: 'text/plain' as const, text: 'abc', byteLength: 3, contentDigest: id.contentDigest };
    expect(recoveryUploadMatches(id, upload)).toBe(true);
    for (const patch of [{ name: 'other.txt' }, { contentDigest: 'b'.repeat(64) }, { byteLength: 4 }, { recoveryScopeId: 'other' }]) expect(recoveryUploadMatches(id, { ...upload, ...patch })).toBe(false);
  });
});
