import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createAttachmentInput, type AttachmentPorts } from '../src/attachments/controller';
import { createRecoveryJournal } from '../src/attachments/recovery';
import { bindAttachmentComposer, createAttachmentAdapter, createExistingAttachment } from '../src/attachments/adapter';
import type { AttachmentCapabilities, AttachmentMetadata, AttachmentUpload } from '../../../packages/contracts/src/attachments';
const scope = '10000000-0000-4000-8000-000000000001';
const refId = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const cap: AttachmentCapabilities = { protocol: 'text-v1', recoveryScopeId: scope, projectId: 'project-a', requiresProject: true, mediaTypes: ['text/plain'], extensions: ['.txt'], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192, order: 'knowledge-then-attachments', unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 };
const meta = (n = 1, text = 'hello'): AttachmentMetadata => ({ reference: { kind: 'upload', projectId: 'project-a', resourceId: refId(n), version: 1, contentDigest: hash(text) }, name: `note-${n}.txt`, mediaType: 'text/plain', byteLength: Buffer.byteLength(text), state: 'ready', retained: false, createdAt: '2026-10-06T00:00:00Z', expiresAt: '2026-10-07T00:00:00Z' });
const readiness = { visible: true, online: true, canRead: true, canUpload: true };
function setup(overrides: Partial<AttachmentPorts> = {}, storage = { raw: null as string | null }) {
  let serial = 0;
  const journal = createRecoveryJournal({ read: () => storage.raw, write: value => { storage.raw = value; } });
  const ports = {
    capabilities: vi.fn(async () => cap), list: vi.fn(async () => ({ resources: [meta(1), meta(2), meta(3)], nextCursor: null })),
    upload: vi.fn(async (request: Readonly<AttachmentUpload>, key: string) => ({ uploadKey: key, recoveryScopeId: request.recoveryScopeId, requestDigest: 'a'.repeat(64), replayed: false,
      resource: { ...meta(), name: request.name, byteLength: request.byteLength, reference: { ...meta().reference, contentDigest: request.contentDigest } } })),
    content: vi.fn(async (reference: AttachmentMetadata['reference']) => ({ reference, name: `note-${Number(reference.resourceId.slice(-12))}.txt`, mediaType: 'text/plain' as const, byteLength: 5, text: 'hello' })),
    lookup: vi.fn(async () => null), ...overrides,
  } satisfies AttachmentPorts;
  const input = createAttachmentInput({ binding: { connectionKey: 'connection-a', viewId: 'view-a', projectId: 'project-a' }, readiness, ports, journal,
    now: () => Date.parse('2026-10-06T12:00:00Z'), key: () => `key-${++serial}` });
  return { input, ports, journal, storage };
}
const capture = (input: ReturnType<typeof setup>['input'], ids: string[]) => input.capture({ ids, submissionId: crypto.randomUUID(), intent: 'send', text: 'original draft', conversationProjectId: 'project-a', attachmentContext: true });
afterEach(() => vi.useRealTimers());
describe('bound attachment input', () => {
  it('has stable immutable snapshots, no mount reads, no-op readiness, and unsubscribe/dispose cleanup', () => {
    const { input, ports } = setup(); const initial = input.getSnapshot(), listener = vi.fn(); const unsubscribe = input.subscribe(listener);
    input.setReadiness({ ...readiness }); expect(input.getSnapshot()).toBe(initial); expect(listener).not.toHaveBeenCalled(); expect(ports.capabilities).not.toHaveBeenCalled();
    input.setReadiness({ ...readiness, online: false }); expect(listener).toHaveBeenCalledTimes(1); expect(Object.isFrozen(input.getSnapshot().readiness)).toBe(true);
    unsubscribe(); input.dispose(); expect(listener).toHaveBeenCalledTimes(1); expect(() => capture(input, [])).toThrow(/closed/);
  });
  it('preserves BOM/CRLF/Unicode bytes and immutable submission intent before asynchronous preparation', async () => {
    const { input, ports } = setup(); const original = '\uFEFFhello\r\n e\u0301🙂'; const file = new File([original], 'note.txt', { type: 'text/plain' });
    const item = await input.upload(file); expect(item.state).toBe('ready'); const request = vi.mocked(ports.upload).mock.calls[0]![0]; expect(request.text).toBe(original); expect(Object.isFrozen(request)).toBe(true);
    const selected = [item.id]; const frozen = capture(input, selected); selected.length = 0;
    expect(frozen.attachments).toHaveLength(1); expect(frozen.intent).toBe('send'); expect(frozen.text).toBe('original draft'); expect(Object.isFrozen(frozen.attachments[0])).toBe(true);
    input.remove(item.id); await input.browse(); const newerId = input.select(meta()); input.consume(frozen); expect(input.getSnapshot().items.map(value => value.id)).toEqual([newerId]);
    expect(() => input.consume(frozen)).toThrow(/no longer valid/); expect(ports.content).not.toHaveBeenCalled();
  });
  it('rejects unsupported bytes and storage failure before any upload side effect', async () => {
    const { input, ports } = setup(); const invalid = await input.upload(new File([new Uint8Array([0xff])], 'bad.txt', { type: 'text/plain' })); expect(invalid.state).toBe('error'); expect(ports.upload).not.toHaveBeenCalled();
    input.remove(invalid.id); const large = await input.upload(new File(['a'.repeat(8193)], 'large.txt')); expect(large.state).toBe('error'); expect(ports.upload).not.toHaveBeenCalled();
    const journal = createRecoveryJournal({ read: () => null, write: () => { throw Error('storage quota'); } });
    const denied = createAttachmentInput({ binding: { connectionKey: 'c', viewId: 'v', projectId: 'project-a' }, readiness, ports, journal });
    expect((await denied.upload(new File(['hello'], 'note.txt'))).error).toContain('storage quota'); expect(ports.upload).not.toHaveBeenCalled();
  });
  it('restores unknown original key after reconstruction and never auto-selects lookup receipts', async () => {
    let original: { request: Readonly<AttachmentUpload>; key: string } | undefined;
    const first = setup({ upload: async (request, key) => { original = { request, key }; throw Error('ACK lost'); } });
    const file = new File(['hello'], 'note.txt'); const item = await first.input.upload(file); expect(item.state).toBe('unknown'); expect(first.journal.list()[0]?.state).toBe('unknown');
    const next = setup({}, first.storage); await next.input.recover('key-1'); expect(next.input.getSnapshot().error).toContain('No committed receipt'); expect(next.ports.upload).not.toHaveBeenCalled();
    expect((await next.input.upload(new File(['different'], 'note.txt'), undefined, next.journal.list()[0])).state).toBe('error'); expect(next.ports.upload).not.toHaveBeenCalled();
    const recovered = await next.input.upload(file, undefined, next.journal.list()[0]); expect(recovered.state).toBe('ready'); expect(vi.mocked(next.ports.upload).mock.calls[0]?.slice(0, 2)).toEqual([original!.request, original!.key]);
    next.input.remove(recovered.id); const record = next.journal.list()[0]!;
    const lookup = setup({ lookup: async () => ({ receipt: { uploadKey: record.key, recoveryScopeId: scope, requestDigest: 'a'.repeat(64), resource: record.resource! }, current: { state: 'ready', retained: false } }) }, first.storage);
    await lookup.input.recover(record.key); expect(lookup.input.getSnapshot().items).toHaveLength(0); expect(lookup.input.getSnapshot().recovery[0]?.state).toBe('ready');
    lookup.input.forgetRecovery(record.key); expect(lookup.input.getSnapshot().recovery).toEqual([]); expect(lookup.ports.upload).not.toHaveBeenCalled();
  });
  it('refuses cross-namespace recovery before lookup and unsupported capability before POST', async () => {
    const first = setup({ upload: async () => { throw Error('unknown'); } }); await first.input.upload(new File(['hello'], 'note.txt'));
    const other = setup({ capabilities: async () => ({ ...cap, recoveryScopeId: refId(9) }) }, first.storage); await other.input.recover('key-1'); expect(other.input.getSnapshot().error).toContain('another center'); expect(other.ports.lookup).not.toHaveBeenCalled();
    const unsupported = setup({ capabilities: async () => null }); await unsupported.input.upload(new File(['hello'], 'note.txt')); expect(unsupported.ports.upload).not.toHaveBeenCalled(); expect(capture(unsupported.input, []).attachments).toEqual([]);
  });
  it('validates complete attachments again, combined budgets, expiry and explicit conversation capability', async () => {
    const { input } = setup(); await input.browse(); const id = input.select(meta()); expect(createExistingAttachment(input, id).content).toEqual([]);
    expect(() => input.capture({ ids: [id], submissionId: 's', intent: 'send', text: 'draft', attachmentContext: false })).toThrow(/cannot accept/);
    expect(() => capture(input, [id, id])).toThrow();
    const knowledge = [{ projectId: 'project-a', sourceId: refId(7), version: 1, contentDigest: 'a'.repeat(64), locator: { kind: 'utf8-bytes' as const, start: 0, end: 4096 } }, { projectId: 'project-a', sourceId: refId(8), version: 1, contentDigest: 'b'.repeat(64), locator: { kind: 'utf8-bytes' as const, start: 0, end: 4096 } }];
    expect(() => input.capture({ ids: [id], submissionId: 's', intent: 'queue', text: 'draft', conversationProjectId: 'project-a', attachmentContext: true, knowledge })).toThrow(/8192/);
    const expired = setup({ list: async () => ({ resources: [{ ...meta(), state: 'expired' }], nextCursor: null }) }); await expired.input.browse(); expect(() => expired.input.select(meta())).toThrow(/expired/);
  });
  it('loads only explicit previews, verifies full digest/identity and caches within four bodies', async () => {
    const { input, ports } = setup(); await input.browse(); expect(ports.content).not.toHaveBeenCalled(); input.select(meta()); expect(ports.content).not.toHaveBeenCalled();
    await input.preview(meta().reference); await input.preview(meta().reference); expect(ports.content).toHaveBeenCalledTimes(1); expect(Object.values(input.getSnapshot().bodies)[0]?.text).toBe('hello');
    const wrong = setup({ content: async reference => ({ reference, name: 'note-1.txt', mediaType: 'text/plain', byteLength: 5, text: 'wrong' }) }); await wrong.input.browse(); await wrong.input.preview(meta().reference); expect(Object.values(wrong.input.getSnapshot().bodies)[0]?.error).toContain('digest');
  });
  it('settles two ignored-abort preview timeouts, releases slots and ignores late results on retry', async () => {
    const resolvers: ((value: any) => void)[] = []; const content = vi.fn(() => new Promise<any>(resolve => resolvers.push(resolve)));
    const { input } = setup({ content }); await input.browse(); vi.useFakeTimers(); const a = input.preview(meta(1).reference), b = input.preview(meta(2).reference); await Promise.resolve(); await Promise.resolve();
    await input.preview(meta(3).reference); expect(input.getSnapshot().error).toContain('Two previews');
    await vi.advanceTimersByTimeAsync(15001); await Promise.all([a, b]); expect(Object.values(input.getSnapshot().bodies).every(body => !body.loading && body.error?.includes('timed out'))).toBe(true);
    const retry = input.preview(meta(1).reference); await Promise.resolve(); await Promise.resolve(); expect(content).toHaveBeenCalledTimes(3);
    resolvers[0]!({ reference: meta().reference, name: 'note-1.txt', mediaType: 'text/plain', byteLength: 5, text: 'hello' }); await Promise.resolve(); expect(Object.values(input.getSnapshot().bodies)[0]?.text).toBeUndefined();
    input.dispose(); await retry;
  });
  it('offline aborts outstanding upload locally, keeps original recovery and requires explicit retry', async () => {
    let resolve!: (v: any) => void; let signal!: AbortSignal;
    const first = setup({ upload: async (_request, _key, value) => { signal = value; return new Promise(r => { resolve = r; }); } });
    const pending = first.input.upload(new File(['hello'], 'note.txt')); await vi.waitFor(() => expect(signal).toBeDefined());
    first.input.setReadiness({ ...readiness, online: false }); expect(signal.aborted).toBe(true); await pending;
    expect(first.journal.list()[0]?.state).toBe('unknown'); first.input.setReadiness(readiness); expect(first.input.getSnapshot().items[0]?.state).toBe('unknown');
    resolve({}); await Promise.resolve(); expect(first.input.getSnapshot().items[0]?.state).toBe('unknown');
    first.input.setReadiness({ ...readiness, visible: false }); await first.input.browse(); expect(first.ports.list).not.toHaveBeenCalled();
  });
  it('bounds ignored-abort upload and list requests; timeout keeps original key and releases the slot', async () => {
    let settle!: (value: any) => void;
    const upload = vi.fn(() => new Promise<any>(resolve => { settle = resolve; }));
    const { input, journal, ports } = setup({ upload });
    vi.useFakeTimers();
    const pending = input.upload(new File(['hello'], 'note.txt'));
    await vi.waitFor(() => expect(upload).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(15001); await pending;
    expect(input.getSnapshot().items[0]?.state).toBe('unknown'); expect(journal.list()[0]?.key).toBe('key-1');
    input.remove(input.getSnapshot().items[0]!.id);
    const request = upload.mock.calls[0] as unknown as [AttachmentUpload, string];
    upload.mockImplementationOnce(async () => ({ uploadKey: request[1], recoveryScopeId: scope, requestDigest: 'a'.repeat(64), replayed: true, resource: { ...meta(), name: 'note.txt' } }));
    const retried = await input.upload(new File(['hello'], 'note.txt'), undefined, journal.list()[0]); expect(retried.state).toBe('ready');
    expect(upload.mock.calls[1]?.slice(0, 2)).toEqual(request.slice(0, 2));
    settle({}); await Promise.resolve(); expect(input.getSnapshot().items[0]?.state).toBe('ready');
    await input.browse(); const oldPage = input.getSnapshot().page;
    vi.mocked(ports.list).mockImplementationOnce(() => new Promise(() => {}));
    const list = input.browse(); await vi.advanceTimersByTimeAsync(15001); await list;
    expect(input.getSnapshot().loading).toBe(false); expect(input.getSnapshot().page).toBe(oldPage); expect(input.getSnapshot().error).toContain('timed out');
    await input.browse(); expect(input.getSnapshot().error).toBeNull();
  });
  it('rejects prepared identity/order drift and invalidates old capture after authorization changes', async () => {
    const { input } = setup(); await input.browse(); const a = input.select(meta(1)), b = input.select(meta(2));
    const frozen = capture(input, [a, b]); expect(() => input.assertCapture(frozen, [b, a])).toThrow(/Prepared attachments/);
    input.setReadiness({ ...readiness, canRead: false }); input.setReadiness(readiness);
    expect(() => input.assertCapture(frozen, [a, b])).toThrow(/no longer valid/);
    expect(input.getSnapshot().items).toHaveLength(2);
  });
  it('composer changes do not remove a recovery upload which has not yet been attached', async () => {
    const { input } = setup(); let notify!: () => void;
    const cleanup = bindAttachmentComposer(input, { getState: () => ({ attachments: [] }), subscribe: (cb: () => void) => { notify = cb; return () => {}; } } as any);
    const item = await input.upload(new File(['hello'], 'note.txt')); notify(); await Promise.resolve();
    expect(input.getSnapshot().items.map(value => value.id)).toEqual([item.id]); cleanup();
  });
  it('official adapter has no content injection and complete removal reconciles through public composer state', async () => {
    const { input } = setup(); const adapter = createAttachmentAdapter(input), file = new File(['hello'], 'note.txt');
    const generator = adapter.add({ file }) as AsyncGenerator; const pending = await generator.next(); expect(pending.value.status.type).toBe('running'); const ready = await generator.next(); expect(ready.value.status.type).toBe('requires-action');
    expect((await adapter.send(ready.value)).content).toEqual([]);
    let callback!: () => void; const un = vi.fn(); let attachments = [ready.value]; const composer = { getState: () => ({ attachments, submission: undefined, inTransit: [] }), subscribe: (cb: () => void) => { callback = cb; return un; } };
    const cleanup = bindAttachmentComposer(input, composer as any); attachments = []; callback(); await Promise.resolve(); expect(input.getSnapshot().items).toHaveLength(0); cleanup(); expect(un).toHaveBeenCalledOnce();
  });
});
