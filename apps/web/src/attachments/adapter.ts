import type { AttachmentAdapter, CompleteAttachment, ComposerRuntime, CreateAttachment } from '@assistant-ui/react';
import type { AttachmentInput, AttachmentItem } from './controller';

function complete(item: AttachmentItem): CompleteAttachment {
  if (item.state !== 'ready' || !item.metadata) throw Error(item.error ?? 'Wait until the file is ready.');
  const content: CompleteAttachment['content'] = []; Object.freeze(content);
  return Object.freeze({ id: item.id, type: 'file', name: item.name, contentType: 'text/plain', status: Object.freeze({ type: 'complete' }), content });
}
/** Actual center references stay in the bound controller, never in prompt text or blob URLs. */
export function createAttachmentAdapter(input: AttachmentInput): AttachmentAdapter {
  return {
    accept: '.txt,text/plain',
    async *add({ file }) {
      const id = crypto.randomUUID();
      yield { id, type: 'file', name: file.name, contentType: 'text/plain', file, status: { type: 'running', reason: 'uploading', progress: 0 } };
      const item = await input.upload(file, id);
      yield { id, type: 'file', name: file.name, contentType: 'text/plain', file, status: item.state === 'ready'
        ? { type: 'requires-action', reason: 'composer-send' }
        : { type: 'incomplete', reason: 'error', message: item.error ?? 'Upload receipt is unknown. Recover with the original key.' } };
    },
    async send(attachment, options) {
      if (options?.signal?.aborted) throw options.signal.reason;
      const item = input.getSnapshot().items.find(value => value.id === attachment.id);
      if (!item) throw Error('This attachment is no longer part of this view.');
      return complete(item);
    },
    async remove(attachment) { input.remove(attachment.id); },
  };
}
export function createExistingAttachment(input: AttachmentInput, id: string): CreateAttachment {
  const item = input.getSnapshot().items.find(value => value.id === id);
  if (!item) throw Error('Select an authorized attachment first.');
  const value = complete(item);
  return { id: value.id, type: value.type, name: value.name, contentType: value.contentType, content: value.content };
}
/** Complete attachments skip adapter.remove. Reconcile public composer state after the synchronous dispatch stack. */
export function bindAttachmentComposer(input: AttachmentInput, composer: Pick<ComposerRuntime, 'getState' | 'subscribe'>): () => void {
  let active = true, queued = false;
  const owned = new Set(composer.getState().attachments.map(item => item.id));
  const reconcile = () => {
    if (queued) return; queued = true;
    queueMicrotask(() => {
      queued = false; if (!active) return;
      const state = composer.getState();
      const ids = new Set([...state.attachments, ...(state.submission?.attachments ?? []), ...(state.inTransit ?? []).flatMap(item => item.attachments)].map(item => item.id));
      for (const id of ids) owned.add(id);
      for (const id of owned) if (!ids.has(id)) { owned.delete(id); input.remove(id); }
    });
  };
  const unsubscribe = composer.subscribe(reconcile);
  return () => { active = false; unsubscribe(); };
}
