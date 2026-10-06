import {
  ATTACHMENT_LIMITS, attachmentAcceptedSchema, attachmentCapabilitiesSchema, attachmentContentSchema,
  attachmentListQuerySchema, attachmentListSchema, attachmentReferenceKey, attachmentSelectionSchema,
  attachmentUploadSchema, assertAttachmentTextDigest, decodeAttachmentText,
  type AttachmentAccepted, type AttachmentCapabilities, type AttachmentContent, type AttachmentList,
  type AttachmentMetadata, type AttachmentReceiptLookup, type AttachmentReference, type AttachmentUpload,
} from '../../../../packages/contracts/src/attachments';
import { idSchema } from '@flow/contracts';
import { citationBytes, freezeContextSelection, type FrozenCitation } from '../conversation-context/selection';
import { checkReceipt, freezeMetadata, recoveryUploadMatches, type RecoveryIdentity, type RecoveryJournal, type RecoveryRecord } from './recovery';

export const INPUT_LIMITS = Object.freeze({ timeoutMs: 15000, bodyReads: 2, bodyCache: 4 });
export interface AttachmentBinding { readonly connectionKey: string; readonly viewId: string; readonly projectId: string }
export interface AttachmentReadiness { readonly visible: boolean; readonly online: boolean; readonly canRead: boolean; readonly canUpload: boolean }
/** These ports are already owner-authorized and HTTP-decoded by their host. IDs never grant access. */
export interface AttachmentPorts {
  capabilities(signal: AbortSignal): Promise<AttachmentCapabilities | null>;
  list(query: { q?: string; after?: string; limit: number }, signal: AbortSignal): Promise<AttachmentList>;
  upload(request: Readonly<AttachmentUpload>, key: string, signal: AbortSignal): Promise<AttachmentAccepted>;
  content(reference: Readonly<AttachmentReference>, signal: AbortSignal): Promise<AttachmentContent>;
  lookup(scope: string, key: string, signal: AbortSignal): Promise<AttachmentReceiptLookup | null>;
}
export interface AttachmentItem {
  readonly id: string; readonly name: string; readonly state: 'uploading' | 'unknown' | 'ready' | 'error';
  readonly metadata?: Readonly<AttachmentMetadata>; readonly uploadKey?: string; readonly error?: string;
}
export interface AttachmentBody { readonly loading: boolean; readonly text?: string; readonly error?: string }
export interface AttachmentSnapshot {
  readonly binding: AttachmentBinding; readonly readiness: AttachmentReadiness; readonly disabledReason: string | null;
  readonly capable: boolean | null; readonly items: readonly AttachmentItem[]; readonly page: readonly Readonly<AttachmentMetadata>[];
  readonly loading: boolean; readonly nextCursor: string | null; readonly error: string | null;
  readonly bodies: Readonly<Record<string, AttachmentBody>>; readonly recovery: readonly RecoveryRecord[];
}
export interface AttachmentCapture {
  readonly submissionId: string; readonly binding: AttachmentBinding; readonly intent: 'send' | 'queue'; readonly text: string;
  readonly knowledge: readonly FrozenCitation[]; readonly attachments: readonly Readonly<AttachmentReference>[];
  readonly descriptors: readonly Readonly<AttachmentMetadata>[];
}
export interface AttachmentInput {
  getSnapshot(): AttachmentSnapshot; subscribe(listener: () => void): () => void;
  setReadiness(readiness: AttachmentReadiness): void;
  browse(query?: string, after?: string): Promise<void>;
  upload(file: File, id?: string, retry?: RecoveryIdentity): Promise<AttachmentItem>;
  select(resource: AttachmentMetadata): string; remove(id: string): void;
  restore(values: readonly AttachmentItem[]): void;
  preview(reference: AttachmentReference): Promise<void>;
  recover(key: string): Promise<void>; forgetRecovery(key: string): void;
  capture(input: { ids: readonly string[]; submissionId: string; intent: 'send' | 'queue'; text: string;
    knowledge?: readonly FrozenCitation[]; conversationProjectId?: string; attachmentContext?: boolean }): AttachmentCapture;
  assertCapture(capture: AttachmentCapture, preparedIds?: readonly string[]): void; consume(capture: AttachmentCapture): void;
  dispose(): void;
}
const empty = Object.freeze([]), emptyBodies = Object.freeze({});
const message = (error: unknown) => error instanceof Error ? error.message : 'Attachment operation failed.';
const immutableItem = (item: AttachmentItem) => Object.freeze(item);
/** Local settlement does not depend on a port honoring abort; all late rejections are handled. */
function bounded<T>(controller: AbortController, operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false; let timer: ReturnType<typeof setTimeout>;
    function finish(error: unknown, value?: T) {
      if (done) return; done = true; clearTimeout(timer); controller.signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value as T);
    }
    const abort = () => finish(controller.signal.reason ?? Error('Attachment operation stopped.'));
    if (controller.signal.aborted) { abort(); return; }
    controller.signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => controller.abort(new DOMException('Attachment operation timed out. Retry explicitly; an upload may already be accepted.', 'TimeoutError')), INPUT_LIMITS.timeoutMs);
    Promise.resolve().then(() => { if (controller.signal.aborted) throw controller.signal.reason; return operation(); }).then(value => finish(null, value), finish);
  });
}
function readReason(ready: AttachmentReadiness, closed: boolean) {
  if (closed) return 'This attachment view is closed.';
  if (!ready.canRead) return 'Attachment access is unavailable for this view.';
  if (!ready.visible) return 'Show this view to read attachments.';
  if (!ready.online) return 'Reconnect to read or upload attachments. Your draft is kept.';
  return null;
}

export function createAttachmentInput(options: {
  binding: AttachmentBinding; readiness: AttachmentReadiness; ports: AttachmentPorts; journal: RecoveryJournal;
  now?: () => number; key?: () => string;
}): AttachmentInput {
  const binding = Object.freeze({ ...options.binding, projectId: idSchema.parse(options.binding.projectId) });
  if (!binding.connectionKey || !binding.viewId) throw Error('Connection and view bindings are required.');
  const { ports, journal } = options, now = options.now ?? Date.now, newKey = options.key ?? (() => crypto.randomUUID());
  const listeners = new Set<() => void>(), items = new Map<string, AttachmentItem>(), bodies = new Map<string, AttachmentBody>();
  const flights = new Map<string, AbortController>(), captures = new WeakMap<AttachmentCapture, { epoch: number; items: readonly AttachmentItem[]; used: boolean }>();
  let epoch = 0, closed = false, capabilities: AttachmentCapabilities | null | undefined;
  let snapshot: AttachmentSnapshot = Object.freeze({ binding, readiness: Object.freeze({ ...options.readiness }), disabledReason: readReason(options.readiness, false),
    capable: null, items: empty, page: empty, loading: false, nextCursor: null, error: null, bodies: emptyBodies, recovery: journal.list() });
  function publish(patch: Partial<AttachmentSnapshot> = {}) {
    snapshot = Object.freeze({ ...snapshot, ...patch, items: Object.freeze([...items.values()]), bodies: Object.freeze(Object.fromEntries(bodies)) });
    for (const listener of listeners) listener();
  }
  function requireRead() { if (snapshot.disabledReason) throw Error(snapshot.disabledReason); }
  function requireWrite() { requireRead(); if (!snapshot.readiness.canUpload) throw Error('Uploading is not authorized for this view.'); }
  function current(generation: number, signal: AbortSignal) { return !closed && epoch === generation && !signal.aborted; }
  async function capability(signal: AbortSignal) {
    requireRead();
    if (capabilities === undefined) {
      const value = await ports.capabilities(signal);
      if (signal.aborted || closed) throw Error('Attachment capability read stopped.');
      capabilities = value === null ? null : attachmentCapabilitiesSchema.parse(value);
      if (capabilities && capabilities.projectId !== binding.projectId) { capabilities = undefined; throw Error('Attachment capability belongs to another project.'); }
      publish({ capable: capabilities !== null });
    }
    if (!capabilities) throw Error('This center does not support text attachments.');
    return capabilities;
  }
  function sameProject(resource: AttachmentMetadata) {
    const value = freezeMetadata(resource);
    if (value.reference.projectId !== binding.projectId) throw Error('Attachment belongs to another project.');
    return value;
  }
  function readyResource(resource: AttachmentMetadata) {
    const value = sameProject(resource);
    if (value.state !== 'ready' || Date.parse(value.expiresAt) <= now()) throw Error('This attachment has expired for new messages.');
    return value;
  }
  function known(reference: AttachmentReference) {
    const key = attachmentReferenceKey(reference);
    return [...snapshot.page, ...[...items.values()].flatMap(item => item.metadata ? [item.metadata] : []),
      ...snapshot.recovery.filter(record => record.scope === capabilities?.recoveryScopeId && record.projectId === binding.projectId && record.state === 'ready').flatMap(record => record.resource ? [record.resource] : [])]
      .find(resource => attachmentReferenceKey(resource.reference) === key);
  }
  function cancel() {
    epoch++; for (const flight of flights.values()) flight.abort(Error('Attachment view is no longer readable.')); flights.clear();
    for (const [id, item] of items) if (item.state === 'uploading') items.set(id, immutableItem({ ...item, state: item.uploadKey ? 'unknown' : 'error', error: 'Upload stopped locally. Recover the original request if it was sent.' }));
    for (const [key, body] of bodies) if (body.loading) bodies.set(key, Object.freeze({ ...body, loading: false, error: 'Read stopped. Retry explicitly.' }));
  }
  function checkCapture(value: AttachmentCapture) {
    const token = captures.get(value);
    if (!token || token.used || token.epoch !== epoch || closed) throw Error('This submission capture is no longer valid.');
    if (value.attachments.length) { requireRead(); for (const metadata of value.descriptors) readyResource(metadata); }
    return token;
  }
  const api: AttachmentInput = {
    getSnapshot: () => snapshot,
    subscribe(listener) { if (closed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    setReadiness(value) {
      if (closed || Object.keys(snapshot.readiness).every(key => value[key as keyof AttachmentReadiness] === snapshot.readiness[key as keyof AttachmentReadiness])) return;
      const next = Object.freeze({ ...value });
      if (readReason(next, false) || (snapshot.readiness.canUpload && !next.canUpload)) cancel();
      if (!next.canRead) { capabilities = undefined; bodies.clear(); }
      publish({ readiness: next, disabledReason: readReason(next, false), loading: false, ...(next.canRead ? {} : { capable: null }) });
    },
    async browse(query = '', after) {
      if (snapshot.disabledReason) return;
      const controller = new AbortController(), generation = epoch; flights.get('list')?.abort(); flights.set('list', controller);
      publish({ loading: true, error: null });
      try {
        const request = attachmentListQuerySchema.parse({ ...(query ? { q: query } : {}), ...(after ? { after } : {}), limit: 20 });
        const page = await bounded(controller, async () => { await capability(controller.signal); return attachmentListSchema.parse(await ports.list(request, controller.signal)); });
        if (!current(generation, controller.signal)) return;
        const resources = page.resources.map(sameProject);
        if (new Set(resources.map(resource => attachmentReferenceKey(resource.reference))).size !== resources.length) throw Error('Duplicate attachment directory identity.');
        for (const [id, item] of items) if (item.metadata && item.state === 'error') {
          const exact = resources.find(resource => attachmentReferenceKey(resource.reference) === attachmentReferenceKey(item.metadata!.reference) && resource.name === item.metadata!.name && resource.mediaType === item.metadata!.mediaType && resource.byteLength === item.metadata!.byteLength);
          if (exact) { try { items.set(id, immutableItem({ ...item, state: 'ready', metadata: readyResource(exact), error: undefined })); } catch { /* Expired or released versions remain visibly unavailable. */ } }
        }
        publish({ page: Object.freeze(resources), nextCursor: page.nextCursor, loading: false });
      } catch (error) { if (!closed && epoch === generation && flights.get('list') === controller) publish({ loading: false, error: message(error) }); }
      finally { if (flights.get('list') === controller) flights.delete('list'); }
    },
    async upload(file, id = crypto.randomUUID(), retry) {
      requireWrite(); if (flights.has('upload')) throw Error('One upload is already in progress.');
      if (items.size >= 4 || items.has(id)) throw Error('Remove an attachment before adding another.');
      const controller = new AbortController(), generation = epoch;
      flights.set('upload', controller); items.set(id, immutableItem({ id, name: file.name, state: 'uploading' })); publish({ error: null });
      let sent = false;
      try {
        const accepted = await bounded(controller, async () => {
          if (file.size < 1 || file.size > ATTACHMENT_LIMITS.fileBytes || (file.type && file.type !== 'text/plain')) throw Error('Choose a UTF-8 .txt file of 1–8192 bytes.');
          const text = decodeAttachmentText(new Uint8Array(await file.arrayBuffer()));
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), value => value.toString(16).padStart(2, '0')).join('');
          const cap = await capability(controller.signal); requireWrite();
          const request = Object.freeze(attachmentUploadSchema.parse({ recoveryScopeId: cap.recoveryScopeId, name: file.name, mediaType: 'text/plain', text, byteLength: file.size, contentDigest: digest }));
          if (retry && (retry.projectId !== binding.projectId || !recoveryUploadMatches(retry, request))) throw Error('Reselect the exact original file and filename to retry this upload.');
          if (!current(generation, controller.signal) || !items.has(id)) throw Error('Upload stopped before dispatch.');
          const identity: RecoveryIdentity = Object.freeze({ key: retry?.key ?? newKey(), scope: cap.recoveryScopeId, projectId: binding.projectId, name: request.name,
            mediaType: request.mediaType, byteLength: request.byteLength, contentDigest: request.contentDigest });
          journal.begin(identity); // Storage must succeed before the side effect starts.
          items.set(id, immutableItem({ id, name: file.name, state: 'uploading', uploadKey: identity.key })); publish({ recovery: journal.list() });
          sent = true;
          const result = attachmentAcceptedSchema.parse(await ports.upload(request, identity.key, controller.signal));
          checkReceipt(identity, result);
          if (!current(generation, controller.signal) || !items.has(id)) throw Error('Late upload receipt ignored; recover with the original key.');
          journal.accepted(identity, result); return result;
        });
        if (current(generation, controller.signal) && items.has(id)) { items.set(id, immutableItem({ id, name: file.name, state: 'ready', uploadKey: accepted.uploadKey, metadata: sameProject(accepted.resource) })); publish({ recovery: journal.list() }); }
      } catch (error) {
        if (!closed && epoch === generation && items.has(id)) { items.set(id, immutableItem({ ...items.get(id)!, state: sent ? 'unknown' : 'error', error: message(error) })); publish({ error: message(error), recovery: journal.list() }); }
      } finally { if (flights.get('upload') === controller) flights.delete('upload'); }
      return items.get(id) ?? immutableItem({ id, name: file.name, state: 'error', error: 'Attachment was removed or the view closed.' });
    },
    restore(values) {
      if (closed || items.size || values.length > 4) throw Error('Keep the current attachment draft before restoring another.');
      const restored = values.map(item => {
        if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 128 || typeof item.name !== 'string' || !item.name || item.name.length > 240) throw Error('Invalid saved attachment identity.');
        if (item.uploadKey !== undefined && (typeof item.uploadKey !== 'string' || !item.uploadKey || item.uploadKey.length > 128)) throw Error('Invalid saved upload key.');
        const metadata = item.metadata ? sameProject(item.metadata) : undefined;
        return immutableItem({ id: item.id, name: item.name, state: item.state === 'unknown' || item.state === 'uploading' ? 'unknown' as const : 'error' as const, ...(metadata ? { metadata } : {}), ...(item.uploadKey ? { uploadKey: item.uploadKey } : {}), error: metadata ? 'Restored file is unverified. Refresh the authorized directory to confirm this exact version before a new message.' : 'The original local file is not stored. Explicitly recover the upload or reselect the original file; nothing was uploaded automatically.' });
      });
      if (new Set(restored.map(item => item.id)).size !== restored.length) throw Error('Duplicate saved attachment item.');
      restored.forEach(item => items.set(item.id, item)); publish();
    },
    select(resource) {
      requireRead(); if (!capabilities) throw Error('Read this project directory before selecting an attachment.');
      const knownResource = known(resource.reference);
      if (!knownResource) throw Error('Read authorized metadata before selecting an attachment.');
      const metadata = readyResource(knownResource);
      if (items.size >= 4) throw Error('Select at most four attachments.');
      if ([...items.values()].some(item => item.metadata && attachmentReferenceKey(item.metadata.reference) === attachmentReferenceKey(metadata.reference))) throw Error('This attachment is already selected.');
      const id = crypto.randomUUID(); items.set(id, immutableItem({ id, name: metadata.name, state: 'ready', metadata })); publish(); return id;
    },
    remove(id) {
      const item = items.get(id); if (!item) return;
      if (item.state === 'uploading') { flights.get('upload')?.abort(Error('Attachment removed from draft. Original upload may still commit.')); flights.delete('upload'); }
      items.delete(id); publish(); // No resource DELETE: a local draft never owns center retention.
    },
    async preview(reference) {
      if (snapshot.disabledReason) return;
      const resource = known(reference); if (!resource) { publish({ error: 'This reference is not in the authorized view.' }); return; }
      const key = attachmentReferenceKey(resource.reference), flightKey = `body:${key}`;
      if (flights.has(flightKey) || bodies.get(key)?.text !== undefined) return;
      if ([...flights.keys()].filter(value => value.startsWith('body:')).length >= INPUT_LIMITS.bodyReads) { publish({ error: 'Two previews are reading. Try again shortly.' }); return; }
      const controller = new AbortController(), generation = epoch; flights.set(flightKey, controller);
      bodies.delete(key); bodies.set(key, Object.freeze({ loading: true }));
      while (bodies.size > INPUT_LIMITS.bodyCache) { const oldest = [...bodies.keys()].find(value => !flights.has(`body:${value}`)); if (!oldest) break; bodies.delete(oldest); }
      publish();
      try {
        const body = await bounded(controller, async () => {
          await capability(controller.signal);
          const result = attachmentContentSchema.parse(await ports.content(resource.reference, controller.signal));
          if (attachmentReferenceKey(result.reference) !== key || result.name !== resource.name || result.mediaType !== resource.mediaType || result.byteLength !== resource.byteLength) throw Error('Attachment preview identity changed.');
          await assertAttachmentTextDigest(result.text, resource.reference.contentDigest); return result.text;
        });
        if (current(generation, controller.signal)) { bodies.set(key, Object.freeze({ loading: false, text: body })); publish(); }
      } catch (error) { if (!closed && generation === epoch && flights.get(flightKey) === controller) { bodies.set(key, Object.freeze({ loading: false, error: message(error) })); publish(); } }
      finally { if (flights.get(flightKey) === controller) flights.delete(flightKey); }
    },
    async recover(key) {
      if (snapshot.disabledReason || flights.has('recovery')) return;
      const record = journal.list().find(value => value.key === key);
      if (!record || record.projectId !== binding.projectId) { publish({ error: 'Recovery belongs to another project.' }); return; }
      const controller = new AbortController(), generation = epoch; flights.set('recovery', controller); publish({ error: null });
      try {
        const result = await bounded(controller, async () => {
          const cap = await capability(controller.signal);
          if (record.scope !== cap.recoveryScopeId) throw Error('This recovery record belongs to another center namespace. It was not queried or resent.');
          return ports.lookup(record.scope, record.key, controller.signal);
        });
        if (!current(generation, controller.signal)) return;
        if (result) journal.observed(record, result);
        publish({ recovery: journal.list(), error: result ? null : 'No committed receipt is visible yet. Keep this key; reselect the original file to retry.' });
      } catch (error) { if (!closed && generation === epoch) publish({ error: message(error) }); }
      finally { if (flights.get('recovery') === controller) flights.delete('recovery'); }
    },
    forgetRecovery(key) {
      if (closed) throw Error('This attachment view is closed.');
      journal.forget(key); publish({ recovery: journal.list(), error: null });
    },
    capture(input) {
      if (closed) throw Error('This attachment view is closed.');
      if (!input.submissionId || !['send', 'queue'].includes(input.intent)) throw Error('A submission identity and explicit delivery intent are required.');
      const selected = input.ids.map(id => { const item = items.get(id); if (!item || item.state !== 'ready' || !item.metadata) throw Error('Every attachment must be ready before sending.'); return item; });
      if (selected.length && (input.conversationProjectId !== binding.projectId || !input.attachmentContext)) throw Error('This conversation cannot accept attachments for this project.');
      if (selected.length) { requireRead(); if (!capabilities) throw Error('Confirm attachment capability before sending.'); }
      const knowledge = freezeContextSelection(input.knowledge ?? [], binding.projectId);
      const descriptors = Object.freeze(selected.map(item => readyResource(item.metadata!)));
      const refs = Object.freeze(attachmentSelectionSchema.parse(descriptors.map(item => item.reference)).map(ref => Object.freeze(ref)));
      if (knowledge.length + refs.length > 4 || knowledge.reduce((sum, ref) => sum + citationBytes(ref), 0) + descriptors.reduce((sum, item) => sum + item.byteLength, 0) > 8192) throw Error('Knowledge and files together must fit four references and 8192 bytes.');
      const capture = Object.freeze({ submissionId: input.submissionId, binding, intent: input.intent, text: input.text, knowledge, attachments: refs, descriptors });
      captures.set(capture, { epoch, items: Object.freeze(selected), used: false }); return capture;
    },
    assertCapture(value, preparedIds) { const token = checkCapture(value); if (preparedIds && (preparedIds.length !== token.items.length || preparedIds.some((id, index) => id !== token.items[index]?.id))) throw Error('Prepared attachments no longer match the captured submission.'); },
    consume(value) {
      const token = checkCapture(value); token.used = true;
      for (const item of token.items) if (items.get(item.id) === item) items.delete(item.id);
      publish(); // Called only after a real local receipt has taken ownership, never on network ACK.
    },
    dispose() {
      if (closed) return; cancel(); closed = true; items.clear(); bodies.clear(); capabilities = undefined;
      publish({ page: empty, nextCursor: null, loading: false, disabledReason: readReason(snapshot.readiness, true) }); listeners.clear();
    },
  };
  return api;
}
