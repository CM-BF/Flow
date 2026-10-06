import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowClient } from '../../client/src/index.js';
import { ConversationProjection } from '../../../apps/web/src/conversations/projection';
import { ConversationQueueProjection } from '../../../apps/web/src/conversations/queue/projection';
import { QueueCommands } from '../../../apps/web/src/conversations/queue/commands';
import { conversationMessages } from '../../../apps/web/src/conversations/messages';
import { conversationTurnSchema, type ConversationSnapshot, type ConversationTurn } from './conversations.js';
import { conversationQueueEnqueueSchema, type ConversationQueueItem, type ConversationQueuePage } from './conversation-queue.js';
import {
  ATTACHMENT_ERRORS, ATTACHMENT_LIMITS, assertAttachmentTextDigest, attachmentAcceptedSchema,
  attachmentCapabilitiesSchema, attachmentContentSchema, attachmentDescriptorSchema,
  attachmentListQuerySchema, attachmentListSchema, attachmentMetadataSchema, attachmentNameSchema,
  attachmentReceiptLookupSchema, attachmentReceiptQuerySchema, attachmentReferenceSchema,
  attachmentSelectionSchema, attachmentUploadSchema, decodeAttachmentText,
  type AttachmentCapabilities, type AttachmentDescriptor, type AttachmentUpload,
} from './attachments.js';
import {
  CONVERSATION_CONTEXT_LIMITS, conversationContextReferenceSchema, conversationContextResponseSchema, conversationContextTemplate,
  parseAttachmentContextReceipt, type ConversationContextDetail, type ConversationContextReference,
} from './conversation-context.js';
import type { KnowledgeCitation } from './knowledge.js';

const projectId = 'project-one';
const scope = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000002';
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const encode = (text: string) => new TextEncoder().encode(text);
function descriptor(resourceId = id, text = 'hello'): AttachmentDescriptor {
  return { reference: { kind: 'upload', projectId, resourceId, version: 1, contentDigest: hash(text) }, name: 'notes.txt', mediaType: 'text/plain', byteLength: encode(text).length };
}
function upload(text = 'hello'): AttachmentUpload {
  return { recoveryScopeId: scope, name: 'notes.txt', mediaType: 'text/plain', text, byteLength: encode(text).length, contentDigest: hash(text) };
}
function metadata() {
  return { ...descriptor(), createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-02T00:00:00.000Z', state: 'ready' as const, retained: false };
}
const citation: KnowledgeCitation = { projectId, sourceId: '30000000-0000-4000-8000-000000000001', version: 1, contentDigest: hash('fact'), locator: { kind: 'utf8-bytes', start: 0, end: 4 } };
const source = { citation, byteLength: 4, currentVersionAtFreeze: 1, isCurrentAtFreeze: true };
const base = { id: 'context-one', contextDigest: hash('context'), executionInputId: 'input-one', executionInputDigest: hash('prompt') };
const v1 = { ...base, templateVersion: 1 as const, sources: [source] } satisfies ConversationContextReference;
function v2(attachments = [descriptor()]) {
  return { ...base, templateVersion: 2 as const, order: 'knowledge-then-attachments' as const, sources: [source], attachments } satisfies ConversationContextReference;
}
const capabilities = {
  protocol: 'text-v1', recoveryScopeId: scope, projectId, requiresProject: true,
  mediaTypes: ['text/plain'], extensions: ['.txt'], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192,
  order: 'knowledge-then-attachments', unboundTtlSeconds: 86_400, resourcesPerProject: 128, retainedBytesPerProject: 1_048_576,
} satisfies AttachmentCapabilities;

describe('bounded text attachment wire', () => {
  it('preserves BOM, CRLF, spaces and non-normalized Unicode through fatal decoding and upload parsing', () => {
    const text = '\ufeff  e\u0301\r\n第二行😀\n'; const original = encode(text); const request = upload(text);
    expect(decodeAttachmentText(original)).toBe(text);
    expect(encode(decodeAttachmentText(original))).toEqual(original);
    expect(attachmentUploadSchema.parse(request)).toEqual(request);
    expect(request.text).toBe(text);
  });
  it('uses UTF-8 bytes, accepts the exact 8 KiB boundary and rejects oversized CJK/emoji without truncation', () => {
    expect(attachmentUploadSchema.parse(upload('a'.repeat(8192))).byteLength).toBe(8192);
    for (const text of ['a'.repeat(8193), '中'.repeat(2731), '😀'.repeat(2049)]) {
      expect(attachmentUploadSchema.safeParse(upload(text)).success).toBe(false);
      expect(() => decodeAttachmentText(encode(text))).toThrow();
    }
  });
  it.each([new Uint8Array(), new Uint8Array([0xff]), new Uint8Array([0xc0, 0xaf]), new Uint8Array([0xe2, 0x82]), new Uint8Array([0xed, 0xa0, 0x80])])('rejects empty or malformed UTF-8 instead of replacement decoding', input => {
    expect(() => decodeAttachmentText(input)).toThrow();
  });
  it.each(['', '\0', '\ud800', '\udfff', 'x\ud800y'])('rejects nonrepresentable or empty JSON text %j', text => {
    expect(attachmentUploadSchema.safeParse(upload(text)).success).toBe(false);
  });
  it.each(['../notes.txt', 'C:\\notes.txt', 'folder/notes.txt', 'notes\n.txt', 'notes\u0085.txt', 'notes.pdf', ''])('rejects path/control/unsupported display names %j', name => {
    expect(attachmentNameSchema.safeParse(name).success).toBe(false);
  });
  it('keeps harmless markup as literal display text and accepts the declared extension case-insensitively', () => {
    expect(attachmentNameSchema.parse('<notes>.TXT')).toBe('<notes>.TXT');
  });
  it('fails closed on extra body fields, wrong media, byte counts and malformed digests', () => {
    const valid = upload();
    for (const value of [{ ...valid, path: '/tmp/file' }, { ...valid, mediaType: 'image/png' }, { ...valid, byteLength: 4 }, { ...valid, contentDigest: 'x' }, { ...valid, recoveryScopeId: 'not-uuid' }]) {
      expect(attachmentUploadSchema.safeParse(value).success).toBe(false);
    }
  });
  it('separately verifies the exact cryptographic digest, including BOM and newlines', async () => {
    const text = '\ufeffa\r\n中'; await expect(assertAttachmentTextDigest(text, hash(text))).resolves.toBeUndefined();
    await expect(assertAttachmentTextDigest(text, hash('a\n中'))).rejects.toThrow('attachment_digest_mismatch');
  });
  it('allows only upload references, exact immutable version and distinct ordered identities', () => {
    const first = descriptor().reference; const second = descriptor(secondId).reference;
    expect(attachmentSelectionSchema.parse([second, first])).toEqual([second, first]);
    expect(attachmentSelectionSchema.safeParse([first, first]).success).toBe(false);
    for (const ref of [{ ...first, kind: 'runner-file' }, { ...first, version: 2 }, { ...first, localPath: 'x' }]) expect(attachmentReferenceSchema.safeParse(ref).success).toBe(false);
  });
  it('keeps metadata body-free and validates explicit content byte counts', () => {
    expect(attachmentMetadataSchema.safeParse({ ...metadata(), text: 'hello' }).success).toBe(false);
    expect(attachmentDescriptorSchema.safeParse({ ...descriptor(), url: 'blob:x' }).success).toBe(false);
    expect(attachmentContentSchema.parse({ ...descriptor(), text: 'hello' }).text).toBe('hello');
    expect(attachmentContentSchema.safeParse({ ...descriptor(), text: 'changed' }).success).toBe(false);
  });
  it('keeps historical ready receipts separate from current expired/unavailable observations', () => {
    const receipt = { uploadKey: 'original-key', recoveryScopeId: scope, requestDigest: hash('request'), resource: metadata() };
    expect(attachmentAcceptedSchema.parse({ ...receipt, replayed: true }).resource.state).toBe('ready');
    expect(attachmentReceiptLookupSchema.parse({ receipt, current: { state: 'expired', retained: true } }).receipt).toEqual(receipt);
    expect(attachmentReceiptLookupSchema.parse({ receipt, current: { state: 'unavailable', retained: null } }).current.state).toBe('unavailable');
    expect(attachmentReceiptLookupSchema.safeParse({ receipt, current: { state: 'not-accepted', retained: false } }).success).toBe(false);
    expect(attachmentReceiptQuerySchema.safeParse({ scope, key: 'k', token: 'secret' }).success).toBe(false);
    expect(attachmentReceiptQuerySchema.safeParse({ scope, key: 'key\0' }).success).toBe(false);
    expect(attachmentReceiptQuerySchema.safeParse({ scope, key: '\ud800' }).success).toBe(false);
    expect(ATTACHMENT_ERRORS.attachment_upload_receipt_not_found).toBe(404);
  });
  it('exposes bounded capability and pagination without inferring old-center support', () => {
    expect(attachmentCapabilitiesSchema.parse(capabilities)).toEqual(capabilities);
    expect(capabilities.maxCombinedReferences).toBe(CONVERSATION_CONTEXT_LIMITS.references);
    expect(capabilities.maxCombinedBytes).toBe(CONVERSATION_CONTEXT_LIMITS.rawBytes);
    for (const value of [undefined, false, {}, { ...capabilities, requiresProject: false }, { ...capabilities, protocol: 'other' }, { ...capabilities, ownerToken: 'secret' }]) expect(attachmentCapabilitiesSchema.safeParse(value).success).toBe(false);
    expect(attachmentListQuerySchema.parse({ limit: '20' }).limit).toBe(20);
    expect(attachmentListQuerySchema.safeParse({ limit: 21 }).success).toBe(false);
    expect(attachmentListSchema.safeParse({ resources: Array.from({ length: 21 }, metadata), nextCursor: null }).success).toBe(false);
    expect(ATTACHMENT_LIMITS.fileBytes).toBe(8192);
  });
  it('accepts header-safe original keys without browser trimming or Unicode conversion', () => {
    const key = '550e8400-e29b-41d4-a716-446655440000';
    expect(attachmentReceiptQuerySchema.parse({ scope, key }).key).toBe(new Headers({ 'Idempotency-Key': key }).get('Idempotency-Key'));
    for (const invalid of [' key', 'key ', 'two keys', '中文', 'café', 'key\t', 'key\u007f', '']) {
      expect(attachmentReceiptQuerySchema.safeParse({ scope, key: invalid }).success).toBe(false);
    }
  });
});

describe('additive conversation context receipts', () => {
  it('keeps absent/empty attachments on the exact old v1 wire shape and legacy details unchanged', () => {
    expect(conversationContextTemplate()).toBeNull();
    expect(conversationContextTemplate([], [])).toBeNull();
    expect(conversationContextTemplate([citation])).toBe(1);
    expect(conversationContextTemplate([citation], [])).toBe(1);
    expect(conversationContextReferenceSchema.parse(v1)).toEqual(v1);
    expect(conversationContextReferenceSchema.parse({ ...v1, sources: [] })).toEqual({ ...v1, sources: [] });
    const detail = { id: 'ctx', conversationId: 'conversation', projectId, contextDigest: hash('context'), createdAt: '2026-01-01T00:00:00.000Z', sources: [{ ...source, text: 'fact', currentVersion: 1, isCurrent: true }] } satisfies ConversationContextDetail;
    expect(detail).not.toHaveProperty('templateVersion');
    expect(detail).not.toHaveProperty('attachments');
  });
  it('uses v2 only for nonempty uploads, retaining two explicit ordered segments', () => {
    const attachments = [descriptor(secondId, 'second'), descriptor(id, 'first')]; const actual = v2(attachments);
    expect(conversationContextTemplate([citation], attachments.map(item => item.reference))).toBe(2);
    expect(parseAttachmentContextReceipt({ projectId, knowledge: [citation], attachments }, actual)).toEqual(actual);
    expect(conversationContextReferenceSchema.safeParse({ ...actual, attachments: [] }).success).toBe(false);
    expect(conversationContextReferenceSchema.safeParse({ ...v1, attachments }).success).toBe(false);
    expect(conversationContextReferenceSchema.safeParse({ ...actual, order: 'attachments-then-knowledge' }).success).toBe(false);
  });
  it('enforces combined reference counts and byte budget without applying the 4 KiB knowledge-locator bound to files', () => {
    const full = descriptor(id, 'a'.repeat(8192));
    expect(conversationContextReferenceSchema.safeParse({ ...v2([full]), sources: [] }).success).toBe(true);
    expect(conversationContextReferenceSchema.safeParse(v2([full])).success).toBe(false);
    const four = [id, secondId, '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004'].map(resourceId => descriptor(resourceId));
    expect(conversationContextReferenceSchema.safeParse(v2(four)).success).toBe(false);
    expect(() => conversationContextTemplate([citation], four.map(item => item.reference))).toThrow('conversation_context_budget');
  });
  it('rejects cross-project, duplicate, malformed and body-leaking context metadata', () => {
    const first = descriptor(); const wrong = { ...first, reference: { ...first.reference, projectId: 'other-project' } };
    for (const wire of [v2([wrong]), v2([first, first]), { ...v2(), sources: [{ ...source, byteLength: 3 }] }, { ...v2(), sources: [{ ...source, isCurrentAtFreeze: false }] }, { ...v2(), text: 'leak' }, { ...v2(), id: '' }]) expect(conversationContextReferenceSchema.safeParse(wire).success).toBe(false);
    expect(() => conversationContextTemplate([citation], [wrong.reference])).toThrow('attachment_reference_mismatch');
  });
  it('checks frozen upload receipt descriptors, not merely count/digest presence, while leaving the caller input untouched', () => {
    const attachments = [descriptor(), descriptor(secondId, 'second')]; const expected = { projectId, knowledge: [citation], attachments }; const before = structuredClone(expected);
    for (const wire of [v2([...attachments].reverse()), v2([{ ...attachments[0]!, byteLength: 4 }, attachments[1]!]), v2([{ ...attachments[0]!, name: 'other.txt' }, attachments[1]!]), v2([{ ...attachments[0]!, reference: { ...attachments[0]!.reference, contentDigest: hash('different') } }, attachments[1]!]), v1]) {
      expect(() => parseAttachmentContextReceipt(expected, wire)).toThrow();
    }
    expect(expected).toEqual(before);
    expect(() => parseAttachmentContextReceipt({ ...expected, projectId: 'wrong-project' }, v2(attachments))).toThrow();
  });
  it('checks knowledge order independently and rejects a fabricated current-version observation', () => {
    const another = { ...citation, sourceId: '30000000-0000-4000-8000-000000000002' }; const next = { ...source, citation: another };
    const expected = { projectId, knowledge: [citation, another], attachments: [descriptor()] };
    expect(() => parseAttachmentContextReceipt(expected, { ...v2(), sources: [next, source] })).toThrow('attachment_reference_mismatch');
    expect(conversationContextReferenceSchema.safeParse({ ...v1, sources: [{ ...source, citation: { ...citation, version: 2 } }] }).success).toBe(false);
  });
  it('projects additive response fields away at every nesting level without weakening producer publication checks', () => {
    const original = v2(); const wire = { ...original, future: 'context',
      sources: [{ ...source, future: 'source', citation: { ...citation, future: 'citation', locator: { ...citation.locator, future: 'locator' } } }],
      attachments: [{ ...descriptor(), text: 'must not enter metadata state', future: 'descriptor', reference: { ...descriptor().reference, future: 'reference' } }],
    };
    const before = structuredClone(wire);
    expect(conversationContextReferenceSchema.safeParse(wire).success).toBe(false);
    expect(parseAttachmentContextReceipt({ projectId, knowledge: [citation], attachments: [descriptor()] }, wire)).toEqual(original);
    expect(wire).toEqual(before);
    expect(conversationContextResponseSchema.parse({ ...v1, future: true, sources: wire.sources })).toEqual(v1);
  });
  it('keeps known field, nested locator, version, source consistency and total budget checks strict for additive responses', () => {
    const withExtra = { ...v2(), future: true };
    for (const wire of [
      { ...withExtra, templateVersion: 3 },
      { ...withExtra, sources: [{ ...source, isCurrentAtFreeze: false, future: true }] },
      { ...withExtra, sources: [{ ...source, citation: { ...citation, locator: { ...citation.locator, end: 4097, future: true } } }] },
      { ...withExtra, attachments: [{ ...descriptor(), reference: { ...descriptor().reference, version: 2, future: true } }] },
      { ...withExtra, attachments: [descriptor(id, 'a'.repeat(8192))] },
      { ...withExtra, attachments: [{ ...descriptor(), byteLength: 4, future: true }] },
      { ...withExtra, attachments: [{ ...descriptor(), name: 'different.txt', future: true }] },
    ]) expect(() => parseAttachmentContextReceipt({ projectId, knowledge: [citation], attachments: [descriptor()] }, wire)).toThrow();
  });
});

// Real f181 legacy consumers, unchanged on this branch; only HTTP responses are fixtures.
const disposables: { dispose(): void }[] = [];
afterEach(() => { disposables.splice(0).forEach(value => value.dispose()); vi.unstubAllGlobals(); });
const at = '2026-10-06T10:00:00Z';
function legacySnapshot(): ConversationSnapshot {
  return { conversation: { id: 'chat', projectId, title: 'Chat', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' }, revision: 0, createdAt: at, updatedAt: at },
    capabilities: { followUp: true, queue: true, steer: false, liveAssistantText: false, knowledgeContext: true, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, nativeSession: null, lastTurn: null };
}
function legacyTurn(context: ConversationContextReference): ConversationTurn {
  return { id: 'turn-1', conversationId: 'chat', number: 1, createdAt: at, context, user: { role: 'user', text: 'read this' },
    task: { id: 'task-1', title: 'Read', harness: 'claude', status: 'running', verificationStatus: 'pending', createdAt: at, updatedAt: at },
    assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: 'unknown', source: null },
    telemetry: { kind: 'execution', taskId: 'task-1', title: 'Execution details' } };
}
function legacyItem(context: ConversationContextReference): ConversationQueueItem {
  return { id: 'item-1', conversationId: 'chat', sequence: 1, state: 'waiting', preview: 'read this', truncated: false, promoted: null, createdAt: at, updatedAt: at, context };
}
function legacyPage(context: ConversationContextReference): ConversationQueuePage {
  return { conversationId: 'chat', queueRevision: 1, items: [legacyItem(context)], nextCursor: null, blocked: null, paused: false, currentTurn: null };
}
const clientForFixture = () => new FlowClient({ baseUrl: 'http://fixture.invalid', token: 'public-fixture' });

describe('legacy consumer compatibility using real projection/client/queue code', () => {
  it('requires new clients to omit attachments entirely when sending plain requests to an old strict center', () => {
    const turn = { expectedRevision: 0, mode: 'follow-up', text: 'plain' };
    const queue = { expectedQueueRevision: 0, text: 'plain' };
    expect(conversationTurnSchema.parse(turn)).toEqual(turn);
    expect(conversationQueueEnqueueSchema.parse(queue)).toEqual(queue);
    expect(conversationTurnSchema.safeParse({ ...turn, attachments: [] }).success).toBe(false);
    expect(conversationQueueEnqueueSchema.safeParse({ ...queue, attachments: [] }).success).toBe(false);
  });
  it('reads v2 history and waiting metadata without treating it as body or requesting attachment content', async () => {
    const context = v2(); const turn = legacyTurn(context); const initial = legacySnapshot();
    initial.conversation.revision = 1; initial.lastTurn = turn;
    const reads: string[] = [];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async url => {
      const path = new URL(String(url)).pathname; reads.push(path);
      if (path.endsWith('/turns')) return Response.json({ conversation: initial.conversation, turns: [turn], nextCursor: null });
      if (path.endsWith('/queue')) return Response.json(legacyPage(context));
      if (path.endsWith('/chat')) return Response.json(initial);
      throw Error(`Unexpected request: ${path}`);
    }));
    const client = clientForFixture(); const projection = new ConversationProjection(client, 'chat');
    const queue = new ConversationQueueProjection(client); disposables.push(projection, queue);
    await projection.refresh(); queue.configure('chat', true); await queue.refresh();
    expect(projection.getSnapshot().error).toBeNull(); expect(projection.getSnapshot().turns[0]?.context).toEqual(context);
    expect(queue.getSnapshot().page?.items[0]?.context).toEqual(context);
    const { context: _metadata, ...plainTurn } = turn;
    expect(conversationMessages(projection.getSnapshot().turns)).toEqual(conversationMessages([plainTurn]));
    expect(reads.sort()).toEqual(['/api/conversations/chat', '/api/conversations/chat/queue', '/api/conversations/chat/turns']);
  });
  it('keeps an erroneous v2 Send ACK unknown, then retries the exact original key/body and accepts saved v1', async () => {
    const initial = legacySnapshot(); const calls: { body: string; key: string | null }[] = [];
    initial.capabilities = { ...initial.capabilities, queue: false };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === 'POST') {
        calls.push({ body: String(init.body), key: new Headers(init.headers).get('Idempotency-Key') });
        return Response.json({ conversation: { ...initial.conversation, revision: 1 }, turn: legacyTurn(calls.length === 1 ? v2() : v1), replayed: calls.length > 1 }, { status: 202 });
      }
      return Response.json(String(url).includes('/turns') ? { conversation: initial.conversation, turns: [], nextCursor: null } : initial);
    }));
    const projection = new ConversationProjection(clientForFixture(), 'chat'); disposables.push(projection);
    await projection.refresh(); await projection.send('read this', undefined, [citation]);
    expect(projection.getSnapshot().outbox).toMatchObject({ state: 'unknown', request: { knowledge: [citation] } });
    await projection.retry(); expect(projection.getSnapshot().outbox).toBeNull();
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
    expect(JSON.parse(calls[0]!.body)).not.toHaveProperty('attachments');
  });
  it('keeps an erroneous v2 enqueue ACK unknown without re-keying, then accepts an exact saved v1 replay', async () => {
    const calls: { body: string; key: string | null }[] = [];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (_url, init) => {
      calls.push({ body: String(init?.body), key: new Headers(init?.headers).get('Idempotency-Key') });
      return Response.json({ conversationId: 'chat', queueRevision: 1, item: legacyItem(calls.length === 1 ? v2() : v1), replayed: calls.length > 1 }, { status: 202 });
    }));
    const commands = new QueueCommands(clientForFixture(), async () => {}); disposables.push(commands);
    await commands.execute({ kind: 'enqueue', conversationId: 'chat', input: { expectedQueueRevision: 0, text: 'read this', knowledge: [citation] } });
    const first = commands.getSnapshot()[0]!; expect(first).toMatchObject({ state: 'unknown', everUnknown: true });
    await commands.retry(first.key); expect(commands.getSnapshot()[0]?.state).toBe('accepted');
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
    expect(JSON.parse(calls[0]!.body)).not.toHaveProperty('attachments');
  });
});
