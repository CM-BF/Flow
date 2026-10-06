import { useState, useSyncExternalStore } from 'react';
import { attachmentReferenceKey, type AttachmentMetadata } from '../../../../packages/contracts/src/attachments';
import type { AttachmentInput } from './controller';
import type { RecoveryRecord } from './recovery';
import './attachments.css';

export interface AttachmentPickerProps {
  input: AttachmentInput;
  onAttach(id: string): void | Promise<void>;
  onRemove(id: string): void | Promise<void>;
}
/** Small content surface; the host owns its Dialog and authorized connection/view/project. */
export function AttachmentPicker({ input, onAttach, onRemove }: AttachmentPickerProps) {
  const state = useSyncExternalStore(input.subscribe, input.getSnapshot);
  const [query, setQuery] = useState(''), [localError, setError] = useState<string | null>(null);
  const run = async (operation: () => void | Promise<void>) => { try { setError(null); await operation(); } catch (error) { setError(error instanceof Error ? error.message : 'Attachment action failed.'); } };
  const disabled = Boolean(state.disabledReason) || state.capable === false;
  const add = (resource: AttachmentMetadata) => run(async () => { const id = input.select(resource); try { await onAttach(id); } catch (error) { input.remove(id); throw error; } });
  const retry = (record: RecoveryRecord, file: File) => run(async () => {
    const item = await input.upload(file, undefined, record);
    if (item.state === 'ready') await onAttach(item.id);
    else { input.remove(item.id); throw Error(item.error ?? 'Upload receipt is still unknown.'); }
  });
  return <section className="attachment-picker" aria-label="Project files">
    <p className="attachment-help">UTF-8 text files · up to 8 KiB each. Knowledge and files share a four-item, 8 KiB limit.</p>
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); void run(() => input.browse(query)); }} className="attachment-search">
      <label>Find uploaded files<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filename" maxLength={256} disabled={disabled} /></label>
      <button type="submit" disabled={disabled || state.loading}>{state.loading ? 'Reading…' : 'Browse files'}</button>
    </form>
    <p role="status" className="attachment-help">{state.loading ? 'Reading file metadata.' : `${state.page.length} files on this page. ${state.items.length} in this draft.`}</p>
    {(localError || state.error) && <p role="alert" className="attachment-error">{localError ?? state.error}</p>}
    {state.disabledReason && <p className="attachment-help">{state.disabledReason}</p>}
    {state.capable === false && <p className="attachment-help">This center does not support text attachments. Plain text remains available.</p>}
    {!!state.items.length && <section aria-label="Files in this draft"><h3>In this draft</h3>{state.items.map(item => <article className="attachment-row" key={item.id}>
      <div className="attachment-row-title"><strong>{item.name}</strong><span>{item.state === 'ready' && item.metadata && Date.parse(item.metadata.expiresAt) <= Date.now() ? 'Expired' : item.state}</span><button type="button" onClick={() => void run(() => onRemove(item.id))}>Remove {item.name}</button></div>
      {item.error && <p className="attachment-error">{item.error}</p>}
      {item.metadata && <Preview resource={item.metadata} input={input} disabled={disabled} />}
    </article>)}</section>}
    <section aria-label="Uploaded project files"><h3>Uploaded to this project</h3>{state.page.map(resource => <article className="attachment-row" key={attachmentReferenceKey(resource.reference)}>
      <div className="attachment-row-title"><strong>{resource.name}</strong><span>{resource.byteLength} bytes</span><button type="button" disabled={disabled || resource.state !== 'ready' || Date.parse(resource.expiresAt) <= Date.now()} onClick={() => void add(resource)}>Use {resource.name}</button></div>
      <Preview resource={resource} input={input} disabled={disabled} />
    </article>)}
      {state.nextCursor && <button type="button" disabled={disabled || state.loading} onClick={() => void run(() => input.browse(query, state.nextCursor!))}>Next page</button>}
    </section>
    {!!state.recovery.length && <details className="attachment-recovery"><summary>Upload recovery ({state.recovery.length})</summary><p className="attachment-help">Recovering never sends a message or adds a file to a new draft. A missing receipt still needs its original key.</p>
      {state.recovery.map(record => <article className="attachment-row" key={record.key}>
        <div className="attachment-row-title"><strong>{record.name}</strong><span>{record.state}</span></div>
        <details><summary>Recovery identity</summary><code>{record.projectId} · {record.scope} · {record.key}</code></details>
        <div className="attachment-buttons"><button type="button" disabled={disabled || record.projectId !== state.binding.projectId} onClick={() => void run(() => input.recover(record.key))}>Check receipt for {record.name}</button>
          {record.state === 'unknown' && <label className="attachment-file-action">Reselect original file<input aria-label={`Reselect original ${record.name}`} type="file" accept=".txt,text/plain" disabled={disabled || !state.readiness.canUpload || record.projectId !== state.binding.projectId} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void retry(record, file); }} /></label>}
          {record.state !== 'unknown' && <button type="button" onClick={() => void run(() => input.forgetRecovery(record.key))}>Forget local record for {record.name}</button>}
          {record.state === 'ready' && record.resource && <button type="button" disabled={disabled || record.projectId !== state.binding.projectId} onClick={() => void add(record.resource!)}>Use recovered {record.name}</button>}
        </div>
      </article>)}
    </details>}
    <p className="attachment-help">Removing a draft file does not delete a resource used by a message. Runner files and other formats are not supported here.</p>
  </section>;
}
function Preview({ resource, input, disabled }: { resource: AttachmentMetadata; input: AttachmentInput; disabled: boolean }) {
  const state = useSyncExternalStore(input.subscribe, input.getSnapshot), body = state.bodies[attachmentReferenceKey(resource.reference)];
  return <details className="attachment-preview" onToggle={event => { if (event.currentTarget.open && !disabled) void input.preview(resource.reference); }}>
    <summary>Preview {resource.name}</summary>
    {disabled ? <p>Reading is unavailable. Your reference is kept.</p> : body?.text !== undefined ? <pre>{body.text}</pre> : <>
      {body?.error && <p role="alert">{body.error}</p>}
      <button type="button" disabled={body?.loading} onClick={() => void input.preview(resource.reference)}>{body?.loading ? 'Reading content…' : 'Read content'}</button>
    </>}
    <details><summary>Fixed version</summary><code>{resource.reference.resourceId} · version {resource.reference.version}<br />{resource.reference.contentDigest}</code><p className="attachment-help">New-message availability ends {resource.expiresAt}. Retention preserves accepted messages; it does not extend this limit.</p></details>
  </details>;
}
