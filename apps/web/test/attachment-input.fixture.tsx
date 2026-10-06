import { StrictMode, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessageLike } from '@assistant-ui/react';
import { Thread } from '../src/components/assistant-ui/elements/thread.aui';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../src/components/ui/dialog';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { AttachmentPicker } from '../src/attachments/AttachmentPicker';
import { createAttachmentAdapter, bindAttachmentComposer, createExistingAttachment } from '../src/attachments/adapter';
import { createAttachmentInput, type AttachmentCapture, type AttachmentInput, type AttachmentPorts } from '../src/attachments/controller';
import { createRecoveryJournal } from '../src/attachments/recovery';
import type { AttachmentAccepted, AttachmentCapabilities, AttachmentContent, AttachmentMetadata, AttachmentUpload } from '../../../packages/contracts/src/attachments';
import { applyTheme } from '../src/themes';
import '../src/styles.css';
import '../src/assistant-ui.css';

const scope = '10000000-0000-4000-8000-000000000001';
const resourceId = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cap: AttachmentCapabilities = { protocol: 'text-v1', recoveryScopeId: scope, projectId: 'project-a', requiresProject: true,
  mediaTypes: ['text/plain'], extensions: ['.txt'], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192, order: 'knowledge-then-attachments', unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 };
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), value => value.toString(16).padStart(2, '0')).join('');
type Saved = { request: AttachmentUpload; receipt: AttachmentAccepted };
const fixture = {
  delay: 0, prepareDelay: 0, loseNext: false, unsupported: false, wrongScope: false,
  calls: [] as { operation: string; key?: string; request?: AttachmentUpload }[], saved: new Map<string, Saved>(), contents: new Map<string, AttachmentContent>(), resources: [] as AttachmentMetadata[],
};
async function seed() {
  if (fixture.resources.length) return;
  for (let n = 1; n <= 3; n++) {
    const text = n === 1 ? '<script>globalThis.attachmentInjected=true</script>\nA fixed project note. 原文🙂' : `Project attachment ${n}.\n`, name = `project-${n}.txt`, bytes = new TextEncoder().encode(text).length;
    const reference = { kind: 'upload' as const, projectId: 'project-a', resourceId: resourceId(n), version: 1 as const, contentDigest: await digest(text) };
    fixture.resources.push({ reference, name, mediaType: 'text/plain', byteLength: bytes, state: 'ready', retained: false, createdAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    fixture.contents.set(reference.resourceId, { reference, name, mediaType: 'text/plain', byteLength: bytes, text });
  }
}
const wait = async () => { if (fixture.delay) await new Promise(resolve => setTimeout(resolve, fixture.delay)); };
const ports: AttachmentPorts = {
  async capabilities() { fixture.calls.push({ operation: 'capabilities' }); await wait(); return fixture.unsupported ? null : { ...cap, recoveryScopeId: fixture.wrongScope ? resourceId(99) : scope }; },
  async list(query) { fixture.calls.push({ operation: 'list' }); await seed(); await wait(); return { resources: fixture.resources.filter(item => !query.q || item.name.includes(query.q)).slice(0, query.limit), nextCursor: null }; },
  async upload(request, key) {
    fixture.calls.push({ operation: 'upload', key, request: { ...request } }); await seed(); await wait();
    let saved = fixture.saved.get(key);
    if (saved && JSON.stringify(saved.request) !== JSON.stringify(request)) throw Error('Fixture idempotency conflict.');
    if (!saved) {
      const reference = { kind: 'upload' as const, projectId: 'project-a', resourceId: resourceId(fixture.resources.length + 1), version: 1 as const, contentDigest: request.contentDigest };
      const resource: AttachmentMetadata = { reference, name: request.name, mediaType: request.mediaType, byteLength: request.byteLength, state: 'ready', retained: false, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() };
      saved = { request: { ...request }, receipt: { uploadKey: key, recoveryScopeId: request.recoveryScopeId, requestDigest: await digest(JSON.stringify(request)), resource, replayed: false } };
      fixture.saved.set(key, saved); fixture.resources.push(resource); fixture.contents.set(reference.resourceId, { reference, name: request.name, mediaType: request.mediaType, byteLength: request.byteLength, text: request.text });
    }
    if (fixture.loseNext) { fixture.loseNext = false; throw Error('Fixture lost the upload acknowledgement. Original key is kept.'); }
    return structuredClone(saved.receipt);
  },
  async content(reference) { fixture.calls.push({ operation: 'content' }); await wait(); const value = fixture.contents.get(reference.resourceId); if (!value) throw Error('Fixture body unavailable.'); return structuredClone(value); },
  async lookup(recoveryScope, key) { fixture.calls.push({ operation: 'lookup', key }); await wait(); const saved = fixture.saved.get(key); if (recoveryScope !== scope || !saved) return null; const { replayed: _replayed, ...receipt } = saved.receipt; return { receipt: structuredClone(receipt), current: { state: 'ready', retained: false } }; },
};
const InputContext = createContext<{ input: AttachmentInput; open: boolean; setOpen(value: boolean): void; add(id: string): Promise<void>; remove(id: string): Promise<void>; returnFocus: React.MutableRefObject<HTMLElement | null> } | null>(null);
function Actions() {
  const { input, open, setOpen, add, remove, returnFocus } = useContext(InputContext)!;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="flow-link" onClick={event => { returnFocus.current = event.currentTarget; }}>@file · Project files</button></DialogTrigger>
    <DialogContent style={{ maxWidth: 560, maxHeight: '85dvh', overflow: 'auto' }} onCloseAutoFocus={event => { if (returnFocus.current) { event.preventDefault(); returnFocus.current.focus(); } }}>
      <DialogTitle>Attach a project file</DialogTitle><DialogDescription>Choose uploaded text or recover an interrupted upload. File content is only read when expanded.</DialogDescription>
      <AttachmentPicker input={input} onAttach={add} onRemove={remove} />
    </DialogContent>
  </Dialog>;
}
const components = { ComposerActions: Actions, Welcome: () => <div style={{ margin: 'auto', maxWidth: 400 }}><h1 style={{ fontSize: 22 }}>Bring a text file into the draft</h1><p style={{ color: 'var(--muted-foreground)' }}>Use the attachment button, drag a .txt file, or type @file then Tab. This is an isolated input module.</p></div> };
const identity = (message: ThreadMessageLike) => message;
function ComposerFixture({ input, visible, online, authorized, writable, setVisible, setOnline, setAuthorized, setWritable }: {
  input: AttachmentInput; visible: boolean; online: boolean; authorized: boolean; writable: boolean;
  setVisible(value: boolean): void; setOnline(value: boolean): void; setAuthorized(value: boolean): void; setWritable(value: boolean): void;
}) {
  const state = useSyncExternalStore(input.subscribe, input.getSnapshot), [open, setOpen] = useState(false), [intent, setIntent] = useState<'send' | 'queue'>('send');
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]), [receipts, setReceipts] = useState<AttachmentCapture[]>([]), [error, setError] = useState(''), [held, setHeld] = useState<AttachmentCapture | null>(null);
  const pending = useRef<AttachmentCapture | null>(null), returnFocus = useRef<HTMLElement | null>(null), command = useRef<{ text: string; start: number; end: number } | null>(null);
  const official = useMemo(() => createAttachmentAdapter(input), [input]);
  const adapter = useMemo(() => ({ ...official, send: async (...args: Parameters<typeof official.send>) => { if (fixture.prepareDelay) await new Promise(resolve => setTimeout(resolve, fixture.prepareDelay)); return official.send(...args); } }), [official]);
  const runtime = useExternalStoreRuntime<ThreadMessageLike>({ messages, convertMessage: identity, isRunning: false,
    isSendDisabled: state.items.some(item => item.state !== 'ready') || (state.items.length > 0 && (!visible || !online || !authorized)),
    adapters: { attachments: adapter },
    onNew: async message => {
      const capture = pending.current;
      try {
        if (!capture) throw Error('Capture the draft before preparing attachments.');
        input.assertCapture(capture, (message.attachments ?? []).map(item => item.id));
        // Fixture local receipt ownership is synchronous. There is no real Send/Queue or HTTP admission here.
        setReceipts(previous => [...previous, capture]); input.consume(capture); pending.current = null;
        setMessages(previous => [...previous, { id: capture.submissionId, role: 'user', content: [{ type: 'text', text: capture.text }], attachments: message.attachments },
          { id: `${capture.submissionId}-receipt`, role: 'assistant', content: [{ type: 'text', text: `Local ${capture.intent} capture: ${capture.attachments.length} fixed file references. No model was called.` }] }]);
      } catch (failure) { setError((failure as Error).message); setHeld(capture); pending.current = null; /* Preserve separately; never prepend old text into a newer draft. */ }
    },
  });
  useEffect(() => bindAttachmentComposer(input, runtime.thread.composer), [input, runtime]);
  useLayoutEffect(() => input.setReadiness({ visible, online, canRead: authorized, canUpload: writable }), [input, visible, online, authorized, writable]);
  const add = async (id: string) => {
    await runtime.thread.composer.addAttachment(createExistingAttachment(input, id));
    const mention = command.current, current = runtime.thread.composer.getState().text;
    if (mention && current === mention.text) runtime.thread.composer.setText(current.slice(0, mention.start) + current.slice(mention.end));
    command.current = null;
  };
  const remove = async (id: string) => { const index = runtime.thread.composer.getState().attachments.findIndex(item => item.id === id); if (index >= 0) await runtime.thread.composer.getAttachmentByIndex(index).remove(); input.remove(id); };
  const submit = () => {
    const draft = runtime.thread.composer.getState();
    if (draft.submission) return;
    try {
      const capture = input.capture({ ids: draft.attachments.map(item => item.id), submissionId: crypto.randomUUID(), intent, text: draft.text,
        conversationProjectId: 'project-a', attachmentContext: true });
      pending.current = capture; setError(''); runtime.thread.composer.send({ startRun: false });
    } catch (failure) { setError(messageOf(failure)); }
  };
  return <>
    <div className="fixture-controls">
      <button onClick={() => setVisible(!visible)}>{visible ? 'Hide view' : 'Show view'}</button><button onClick={() => setOnline(!online)}>{online ? 'Offline' : 'Reconnect'}</button>
      <button onClick={() => setAuthorized(!authorized)}>{authorized ? 'Revoke read' : 'Authorize read'}</button><button onClick={() => setWritable(!writable)}>{writable ? 'Revoke upload' : 'Authorize upload'}</button>
      <label><input type="radio" name="intent" checked={intent === 'send'} onChange={() => setIntent('send')} />Send</label><label><input type="radio" name="intent" checked={intent === 'queue'} onChange={() => setIntent('queue')} />Queue</label>
    </div>
    {error && <p role="alert">{error}</p>}
    {held && <details open><summary>Held submission — not sent</summary><pre data-testid="held-capture" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(held)}</pre><p className="attachment-help">This previous capture is kept separately from the current draft. Re-authorize and select files explicitly before a new submission.</p></details>}
    <div hidden={!visible} style={{ height: 'min(650px, 76dvh)' }}><InputContext.Provider value={{ input, open, setOpen, add, remove, returnFocus }}><AssistantRuntimeProvider runtime={runtime}><Thread components={components} autoFocus={false} composerPlaceholder="Draft a message…" sendLabel="Capture draft" composerSubmit={submit}
      composerInputOnKeyDown={event => {
        if (event.nativeEvent.isComposing || !['Tab', 'Enter'].includes(event.key)) return;
        const element = event.currentTarget, end = element.selectionStart, prefix = element.value.slice(0, end);
        if (/(?:^|\s)@file$/.test(prefix)) { event.preventDefault(); event.stopPropagation(); command.current = { text: element.value, start: end - 5, end }; returnFocus.current = element; setOpen(true); }
      }} /></AssistantRuntimeProvider></InputContext.Provider></div>
    <details><summary>Fixture diagnostics</summary><output data-testid="counts">{JSON.stringify({ items: state.items.length, recovery: state.recovery.length, bodyCount: Object.keys(state.bodies).length })}</output><pre data-testid="captures" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(receipts)}</pre></details>
    <p className="attachment-help">Typed in-memory ports only. No public HTTP client, product Send/Queue, database or provider. Upload recovery metadata persists; selected drafts do not automatically restore after reload.</p>
  </>;
}
const messageOf = (failure: unknown) => failure instanceof Error ? failure.message : 'Fixture operation failed.';
function Session({ connection }: { connection: number }) {
  const [input, setInput] = useState<AttachmentInput | null>(null), [visible, setVisible] = useState(true), [online, setOnline] = useState(true), [authorized, setAuthorized] = useState(true), [writable, setWritable] = useState(true);
  useEffect(() => {
    const instance = createAttachmentInput({ binding: { connectionKey: `fixture-${connection}`, viewId: 'fixture-draft', projectId: 'project-a' }, readiness: { visible: true, online: true, canRead: true, canUpload: true }, ports,
      journal: createRecoveryJournal({ read: () => localStorage.getItem('flow-attachment-input-fixture-recovery'), write: value => localStorage.setItem('flow-attachment-input-fixture-recovery', value) }) });
    setInput(instance); return () => instance.dispose();
  }, [connection]);
  return input ? <ComposerFixture key={connection} input={input} visible={visible} online={online} authorized={authorized} writable={writable} setVisible={setVisible} setOnline={setOnline} setAuthorized={setAuthorized} setWritable={setWritable} /> : <p>Preparing input…</p>;
}
function Fixture() {
  const [connection, setConnection] = useState(1);
  return <TooltipProvider><main className="attachment-fixture" style={{ maxWidth: 850, margin: '12px auto', padding: 12 }}><header className="fixture-controls"><h1 style={{ fontSize: 16, marginRight: 'auto' }}>Attachment input preview</h1><button onClick={() => applyTheme('light')}>Light</button><button onClick={() => applyTheme('dark')}>Dark</button><button onClick={() => setConnection(value => value + 1)}>New connection</button></header><Session key={connection} connection={connection} /></main></TooltipProvider>;
}
Object.assign(window, { attachmentFixture: fixture });
applyTheme('light');
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
