import type { AssistantStreamSelection, AssistantStreamReference, AssistantStreamBlock, AssistantStreamSelectedPatchPage } from '../../../contracts/src/assistant-stream.js';
import type { AssistantStreamPage, AssistantStreamPatchPage, AssistantStreamProtocol, ConversationTurn } from "@flow/contracts";
import { applyPatchPage, applySelectedPatchPage, emptyPatchState, readStreamMetadata, validateMetadataPartition, matchesStreamSelection, seedSelectedBlock, utf8Bytes, type PatchState } from "./patches.js";
import { readCanonicalFinal, type CanonicalFinal } from "./presentation.js";

export interface StreamScope { connectionId: string; viewId: string; conversationId: string; turnId: string; taskId: string }
/** Bound by the host to this exact turn/task; clients and credentials stay private. */
export interface StreamPort {
  readSelectedPatches?(options: { attemptId: string; after: number; limit: number; selection: AssistantStreamSelection }, signal: AbortSignal): Promise<AssistantStreamSelectedPatchPage>;
  readBlock?(streamId: string, signal: AbortSignal): Promise<AssistantStreamBlock>;
  readMetadata(options: { after?: string; limit: number }, signal: AbortSignal): Promise<AssistantStreamPage>;
  readPatches(options: { attemptId: string; after: number; limit: number }, signal: AbortSignal): Promise<AssistantStreamPatchPage>;
}
export interface StreamHost {
  turn: ConversationTurn; capability: boolean | undefined; protocol: AssistantStreamProtocol | undefined;
  visible: boolean; online: boolean; finalContent?: string;
}
export interface StreamState {
  scope: Readonly<StreamScope>; enabled: boolean; visible: boolean; online: boolean; loading: boolean; stale: boolean;
  metadata: AssistantStreamPage | null; patches: PatchState | null; final: CanonicalFinal | null;
  hasMore: boolean; error: string | null; retryAt: number | null;
  selections?: readonly ReasoningSelectionState[];
}
export interface ReasoningSelectionState { readonly streamId:string; readonly patches:PatchState|null; readonly loading:boolean; readonly error:string|null }
interface Disclosure { reference:AssistantStreamReference; controller:AbortController; state:PatchState|null; flight?:Promise<void>; hasMore:boolean; error:string|null }
export const MAX_REASONING_SELECTIONS=8;
export const MAX_RESIDENT_STREAM_BYTES=3*1024*1024;
const textSelection=Object.freeze({kind:'text'} as const);
const identity=(r:AssistantStreamReference)=>JSON.stringify([r.taskId,r.attemptId,r.id,r.source,r.nativeSessionId,r.nativeTurnId,r.nativeMessageId,r.channel,r.blockIndex]);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Assistant text could not be read.";
function waitFor<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener("abort", abort, { once: true });
    try { read().then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); }); }
    catch (error) { signal.removeEventListener("abort", abort); reject(error); }
  });
}
export class ConversationStreamProjection {
  private state: StreamState;
  private host: StreamHost | null = null;
  private listeners = new Set<() => void>();
  private lifetime = new AbortController();
  private generation = 0;
  private disposed = false;
  private flight: Promise<void> | undefined;
  private scheduled: ReturnType<typeof setTimeout> | undefined;
  private invalidated = false;
  private failures = 0;
  private disclosures = new Map<string,Disclosure>();
  private selectedReceipts:Record<number,string>={};

  constructor(scope: StreamScope, private readonly port: StreamPort) {
    if ([scope.connectionId, scope.viewId, scope.conversationId, scope.turnId, scope.taskId].some(value => typeof value !== "string" || !value)) throw Error("Stream requires a complete host identity.");
    this.state = { scope: Object.freeze({ ...scope }), enabled: false, visible: false, online: true, loading: false, stale: false,
      metadata: null, patches: null, final: null, hasMore: false, error: null, retryAt: null };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StreamState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  private readable() { return !this.disposed && this.state.enabled && this.state.visible && this.state.online; }
  private current(generation: number) { return this.readable() && generation === this.generation; }
  updateHost(host: StreamHost) {
    const scope = this.state.scope, turn = host.turn;
    if (turn.id !== scope.turnId || turn.conversationId !== scope.conversationId || turn.task.id !== scope.taskId) throw Error("Stream host does not match its bound turn.");
    if (this.disposed) return;
    const before = this.host, wasReadable = this.readable(); this.host = host;
    const protocolChanged = before !== null && before.protocol !== host.protocol;
    if (protocolChanged) {
      this.pause();this.selectedReceipts={};
      this.publish({ metadata: null, patches: null, final: null, hasMore: false, selections: undefined });
    }
    const enabled = host.capability === true && (host.protocol === "patch-v1" || host.protocol === "patch-v2" || (host.protocol === "patch-select-v1" && Boolean(this.port.readSelectedPatches && this.port.readBlock)));
    this.publish({ enabled, visible: host.visible, online: host.online, ...(host.protocol==='patch-select-v1' && this.state.selections===undefined?{selections:Object.freeze([])}:{}) });
    if (!this.readable()) {
      this.pause();
      if (!enabled) this.publish({ metadata: null, patches: null, final: null, hasMore: false, selections: undefined });
      return;
    }
    if (!wasReadable || protocolChanged) { void this.refresh(); return; }
    if (!before || before.turn.task.updatedAt !== turn.task.updatedAt || before.turn.task.status !== turn.task.status
      || before.turn.assistant !== turn.assistant || before.finalContent !== host.finalContent) this.invalidate();
  }
  private pause() {
    for(const id of [...this.disclosures.keys()]) this.closeReasoning(id);
    this.generation++; this.lifetime.abort(); this.lifetime = new AbortController(); this.flight = undefined;
    if (this.scheduled) clearTimeout(this.scheduled); this.scheduled = undefined;
    this.publish({ loading: false, stale: Boolean(this.state.metadata) });
  }
  invalidate() {
    if (this.disposed) return;
    this.invalidated = true; this.publish({ stale: Boolean(this.state.metadata) });
    this.schedule();
  }
  private schedule() {
    if (!this.readable() || this.flight || this.scheduled || this.failures >= 3) return;
    const delay = Math.max(250, (this.state.retryAt ?? 0) - Date.now());
    this.scheduled = setTimeout(() => { this.scheduled = undefined; void this.start(false); }, delay);
  }
  refresh(): Promise<void> { return this.start(true); }
  private start(explicit: boolean): Promise<void> {
    if (!this.readable()) return Promise.resolve();
    if (this.flight) return this.flight;
    if (!explicit && (this.failures >= 3 || (this.state.retryAt ?? 0) > Date.now())) { this.schedule(); return Promise.resolve(); }
    if (explicit) this.failures = 0;
    if (this.scheduled) clearTimeout(this.scheduled); this.scheduled = undefined;
    this.invalidated = false;
    const generation = this.generation, signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15_000)]);
    this.publish({ loading: true, error: null });
    if (!this.current(generation) || signal.aborted) return Promise.resolve();
    const flight = this.read(generation, signal).then(() => {
      if (this.current(generation)) this.failures = 0;
    }).catch(error => {
      if (this.current(generation)) {
        this.failures++; this.publish({ error: errorMessage(error), stale: true, retryAt: Date.now() + Math.min(8000, 500 * 2 ** (this.failures - 1)) });
      }
    }).finally(() => {
      if (this.flight !== flight) return;
      this.flight = undefined; this.publish({ loading: false });
      if (this.invalidated || (this.state.hasMore && !this.state.error) || [...this.disclosures.values()].some(d=>d.hasMore && !d.error)) this.schedule();
    });
    this.flight = flight; return flight;
  }
  private async metadata(signal: AbortSignal): Promise<AssistantStreamPage> {
    let combined: AssistantStreamPage | null = null, after: string | undefined;
    for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
      const raw = await waitFor(() => this.port.readMetadata({ ...(after ? { after } : {}), limit: 100 }, signal), signal);
      if(this.host?.protocol==='patch-select-v1' && (raw as {protocol?:unknown})?.protocol!=='patch-select-v1') throw Error('Selected reads were not acknowledged by the center.');
      const page = await readStreamMetadata(raw, this.state.scope.taskId);
      if (signal.aborted) throw signal.reason;
      if (this.host?.protocol === "patch-v1" && page.blocks.some(block => block.source !== "claude.sdk.stream")) throw Error("Stream source is outside the negotiated protocol.");
      if (combined) {
        if (page.attemptId !== combined.attemptId || page.finalMessageId !== combined.finalMessageId
          || JSON.stringify(page.settlement) !== JSON.stringify(combined.settlement)) throw Error("Stream metadata changed during pagination. Refresh to retry.");
        if (page.blocks.some(block => combined!.blocks.some(other => other.id === block.id))
          || (page.blocks[0]?.firstSequence ?? Infinity) <= (combined.blocks.at(-1)?.firstSequence ?? 0)) throw Error("Stream metadata page overlaps its cursor.");
        combined = { ...page, blocks: [...combined.blocks, ...page.blocks] };
      } else combined = page;
      if (combined.blocks.length > 256) throw Error("Stream metadata exceeds its block budget.");
      if (page.nextCursor === null) { validateMetadataPartition(combined); return combined; }
      if (page.nextCursor === after) throw Error("Stream metadata cursor stalled.");
      after = page.nextCursor;
    }
    throw Error("Stream metadata exceeds its page budget.");
  }
  private async read(generation: number, signal: AbortSignal) {
    let metadata = await this.metadata(signal);
    if (!this.current(generation) || signal.aborted) return;
    const previous = this.state.metadata;
    if (previous && Date.parse(metadata.taskUpdatedAt) < Date.parse(previous.taskUpdatedAt)) throw Error("Stream metadata moved backwards.");
    const previousPatches = this.state.patches;
    let patches: PatchState;
    if (!metadata.attemptId) { for(const id of [...this.disclosures.keys()])this.closeReasoning(id); this.publish({ metadata, patches: null, final: null, hasMore: false, stale: false }); return; }
    if (!previousPatches || previousPatches.attemptId !== metadata.attemptId) {
      for(const id of [...this.disclosures.keys()]) this.closeReasoning(id);
      this.selectedReceipts={};
      patches = emptyPatchState(metadata.taskId, metadata.attemptId);
      this.publish({ metadata, patches, final: null, hasMore: false });
    } else patches=previousPatches;
    let hasMore = false;
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      const currentPatches: PatchState = patches;
      const selected=this.host?.protocol==='patch-select-v1';
      const page = await waitFor(() => selected
        ? this.port.readSelectedPatches!({attemptId:currentPatches.attemptId,after:currentPatches.cursor,limit:8,selection:textSelection},signal)
        : this.port.readPatches({ attemptId: currentPatches.attemptId, after: currentPatches.cursor, limit: 8 }, signal), signal);
      if (!this.current(generation) || signal.aborted) return;
      // Metadata and patches are separate snapshots: a newly committed block requires a bounded metadata refresh.
      if (Array.isArray(page?.patches) && page.patches.some(patch => !metadata.blocks.some(block => block.id === patch?.streamId))) {
        const refreshed = await this.metadata(signal);
        if (!this.current(generation) || signal.aborted) return;
        if (refreshed.attemptId !== metadata.attemptId) throw Error("Stream attempt changed while reading patches. Refresh to retry.");
        metadata = refreshed;
      }
      const result: {state:PatchState;hasMore:boolean} = await (selected ? applySelectedPatchPage(patches,page,patches.cursor,metadata.blocks,textSelection) : applyPatchPage(patches, page, patches.cursor, metadata.blocks));
      if (!this.current(generation) || signal.aborted) return;
      if(selected)this.rememberSelected(result.state);
      patches = result.state; hasMore = result.hasMore;
      const host = this.host;
      if (!host) return;
      const final = await readCanonicalFinal(host.turn, host.finalContent);
      if (!this.current(generation) || signal.aborted) return;
      this.trimResident(patches,final);
      this.publish({ metadata, patches, final, hasMore, error: null, retryAt: null, stale: false });
      if (!hasMore) {
        if (metadata.blocks.filter(reference=>!selected || matchesStreamSelection(reference,textSelection)).some(reference => (patches!.blocks.find(block => block.streamId === reference.id)?.revision ?? 0) < reference.revision))
          throw Error("Stream patch history has not reached the recorded metadata. Refresh to retry.");
        break;
      }
    }
    for(const [id,entry] of this.disclosures) {
      const reference=metadata.blocks.find(ref=>ref.id===id);
      if(!reference || identity(reference)!==identity(entry.reference)) { this.closeReasoning(id); continue; }
      void this.readDisclosure(id,entry,false);
      if(!this.current(generation) || signal.aborted) return;
    }
  }
  getResidentBytes = () => this.resident();
  private rememberSelected(state:PatchState) {
    const next={...this.selectedReceipts};
    for(const [sequence,fingerprint] of Object.entries(state.receipts)) {
      const key=Number(sequence);
      if(next[key] && next[key]!==fingerprint)throw Error('Sealed selected patch changed across disclosure.');
      next[key]=fingerprint;
    }
    if(Object.keys(next).length>4096)throw Error('Selected attempt receipt budget exceeded.');
    this.selectedReceipts=next;
  }
  private publishSelections() {
    this.publish({selections:Object.freeze([...this.disclosures].map(([streamId,d])=>Object.freeze({streamId,patches:d.state,loading:Boolean(d.flight),error:d.error})))});
  }
  private resident(patches=this.state.patches,final=this.state.final) {
    const states=[patches,...[...this.disclosures.values()].map(d=>d.state)];
    return states.reduce((sum,state)=>sum+(state?.blocks.reduce((n,b)=>n+utf8Bytes(b.content)+utf8Bytes(b.text),0)??0),0)+(final?utf8Bytes(final.text):0);
  }
  private trimResident(patches:PatchState,final:CanonicalFinal|null) {
    for(const id of [...this.disclosures.keys()]) { if(this.resident(patches,final)<=MAX_RESIDENT_STREAM_BYTES) break; this.closeReasoning(id); }
    if(this.resident(patches,final)>MAX_RESIDENT_STREAM_BYTES) throw Error('Stream resident byte budget exceeded.');
  }
  openReasoning(streamId:string):Promise<void> {
    if(!this.readable() || this.host?.protocol!=='patch-select-v1' || !this.port.readBlock || !this.port.readSelectedPatches) return Promise.reject(Error('Selected reads are unavailable.'));
    const reference=this.state.metadata?.blocks.find(ref=>ref.id===streamId);
    if(!reference || reference.source!=='codex.app-server.stream' || reference.channel==='text') return Promise.reject(Error('Only verified reasoning metadata may be opened.'));
    let entry=this.disclosures.get(streamId);
    if(!entry) {
      if(this.disclosures.size>=MAX_REASONING_SELECTIONS) return Promise.reject(Error('Too many open reasoning blocks.'));
      entry={reference:Object.freeze({...reference}),controller:new AbortController(),state:null,hasMore:false,error:null};this.disclosures.set(streamId,entry);
    }
    return this.readDisclosure(streamId,entry,true);
  }
  closeReasoning(streamId:string) {
    const entry=this.disclosures.get(streamId);if(!entry)return;
    entry.controller.abort();this.disclosures.delete(streamId);this.publishSelections();
  }
  private readDisclosure(id:string,entry:Disclosure,explicit:boolean):Promise<void> {
    if(entry.flight)return entry.flight;
    if(entry.error && !explicit)return Promise.resolve();
    const generation=this.generation,signal=AbortSignal.any([this.lifetime.signal,entry.controller.signal,AbortSignal.timeout(15000)]);
    const retained=()=>this.current(generation)&&this.disclosures.get(id)===entry;
    const current=()=>retained()&&!signal.aborted;
    const flight=(async()=>{
      entry.error=null;
      let state=entry.state;
      if(!state) {
        const raw=await waitFor(()=>this.port.readBlock!(id,signal),signal);
        if(!current())return;
        let reference=this.state.metadata?.blocks.find(ref=>ref.id===id);
        if(!reference || identity(reference)!==identity(entry.reference))throw Error('Reasoning selection identity changed.');
        if(raw.revision!==reference.revision) {
          const refreshed=await this.metadata(signal);
          if(!current())return;
          reference=refreshed.blocks.find(ref=>ref.id===id);
          if(refreshed.attemptId!==entry.reference.attemptId || !reference || identity(reference)!==identity(entry.reference) || raw.revision!==reference.revision)
            throw Error('Reasoning snapshot changed during its bounded metadata refresh.');
        }
        state=await seedSelectedBlock(raw,reference);
        if(!current())return;
      }
      entry.state=state;
      if(this.resident()>MAX_RESIDENT_STREAM_BYTES) {entry.state=null;throw Error('Reasoning resident budget exceeded.');}
      this.publishSelections();
      if(state.blocks[0]?.phase!=='streaming')return;
      for(let page=0;page<1;page++) {
        const selection=Object.freeze({kind:'block' as const,streamId:id}),previous=state;
        const raw=await waitFor(()=>this.port.readSelectedPatches!({attemptId:previous.attemptId,after:previous.cursor,limit:8,selection},signal),signal);
        if(!current())return;
        const reference=this.state.metadata?.blocks.find(ref=>ref.id===id);
        if(!reference || identity(reference)!==identity(entry.reference))throw Error('Reasoning selection identity changed.');
        const result=await applySelectedPatchPage(previous,raw,previous.cursor,[reference],selection);
        if(!current())return;
        this.rememberSelected(result.state);
        state=result.state;entry.state=state;entry.hasMore=result.hasMore;
        if(this.resident()>MAX_RESIDENT_STREAM_BYTES) { entry.state=null;entry.hasMore=false;throw Error('Reasoning resident budget exceeded.'); }
        this.publishSelections();
        if(!entry.hasMore)break;
      }
    })().catch(error=>{if(retained()){entry.error=errorMessage(error);entry.hasMore=false;}}).finally(()=>{
      if(this.disclosures.get(id)!==entry || entry.flight!==flight)return;
      entry.flight=undefined;this.publishSelections();if(entry.hasMore&&!entry.error)this.schedule();
    });
    entry.flight=flight;this.publishSelections();return flight;
  }
  dispose() {
    if (this.disposed) return;
    this.pause(); this.state = { ...this.state, metadata: null, patches: null, final: null, hasMore: false }; this.disposed = true; this.host = null; this.listeners.clear();
  }
}
export const createConversationStreamProjection = (scope: StreamScope, port: StreamPort) => new ConversationStreamProjection(scope, port);
