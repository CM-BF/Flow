import type { FlowClient } from '@flow/client';
import { MAX_DETAIL_BYTES, type ConversationTurn, type NativeActivity, type NativeActivityReference } from '@flow/contracts';
import { ConversationStreamProjection, projectBodySegments, readCanonicalFinal, utf8Bytes, type BodySegment } from '../stream/index.js';
import { parseNativeActivityPage, parseNativeActivityBody } from '../activity/index.js';
import { observationPage } from './page.js';
import { ObservationReads } from './reads.js';
export type ObservationClient = Pick<FlowClient,'assistantStream'|'assistantStreamPatches'|'nativeActivities'|'nativeActivity'|'conversationDetail'>;
export interface TurnObservationView {
  turnId: string; number: number; textPage: number|null; panel: 'body'|'activity'|'detail'|'reply'; segments: readonly BodySegment[];
  loading: boolean; stale: boolean; error: string|null;
  activities: readonly NativeActivityReference[]; activityStale: boolean; hasMore: boolean;
  detail: {title:string; text:string; truncated:boolean; redacted:boolean}|null;
}

/** Owns one selected turn's read lifetime, not any execution or durable reply state. */
export class TurnObservation {
  private turn: ConversationTurn|null = null;
  private capability = false;
  private stream: ConversationStreamProjection|null = null;
  private unsubscribe?: () => void;
  private lifetime = new AbortController();
  private generation = 0;
  private visible = false;
  private state: TurnObservationView|null = null;
  private next: string|null = null;
  private bodies = new Map<string,NativeActivity>();
  private finalContent?: string;
  constructor(private client: ObservationClient, private connectionId: string, private reads: ObservationReads, private changed: (value:TurnObservationView|null)=>void) {}
  private publish(patch: Partial<TurnObservationView> = {}) {
    if (!this.state || !this.turn || !this.stream) return;
    const stream = this.stream.getSnapshot();
    this.state = {...this.state,...patch,segments:projectBodySegments(this.turn,stream),stale:stream.stale,error:patch.error === undefined ? stream.error : patch.error};
    this.changed(this.state);
  }
  update(turn: ConversationTurn, capability: boolean, visible: boolean) {
    if (this.turn?.id !== turn.id) {
      this.dispose(); this.turn=turn; this.finalContent=undefined; this.next=null; this.bodies.clear();
      this.state={turnId:turn.id,number:turn.number,textPage:null,panel:'body',segments:[],loading:false,stale:false,error:null,activities:[],activityStale:false,hasMore:false,detail:null};
      const taskId=turn.task.id;
      this.stream=new ConversationStreamProjection({connectionId:this.connectionId,viewId:'terminal',conversationId:turn.conversationId,turnId:turn.id,taskId}, {
        readMetadata:(options,signal)=>this.reads.run(signal,()=>this.client.assistantStream(taskId,options,signal)),
        readPatches:(options,signal)=>this.reads.run(signal,()=>this.client.assistantStreamPatches(taskId,options,signal)),
      });
      this.unsubscribe=this.stream.subscribe(()=>this.publish());
    }
    if (this.turn && this.state?.activities.length && (this.turn.task.updatedAt !== turn.task.updatedAt || this.turn.task.status !== turn.task.status)) this.state={...this.state,activityStale:true};
    this.turn=turn; this.capability=capability; this.visible=visible; this.updateHost();
  }
  private updateHost() {
    if (this.turn) this.stream?.updateHost({turn:this.turn,capability:this.capability,protocol:'patch-v1',visible:this.visible,online:this.visible,finalContent:this.finalContent});
    this.publish();
  }
  pause() {
    this.visible=false; this.generation++; this.lifetime.abort(); this.lifetime=new AbortController();
    this.updateHost(); if (this.state) this.publish({loading:false});
  }
  async refresh() { if (this.visible) await this.stream?.refresh(); }
  private async read<T>(read:(signal:AbortSignal)=>Promise<T>): Promise<T> {
    if (!this.visible || !this.turn) throw Error('Open a connected turn first.');
    const generation=this.generation, signal=AbortSignal.any([this.lifetime.signal,AbortSignal.timeout(15_000)]);
    this.publish({loading:true,error:null});
    try { const value=await this.reads.run(signal,()=>read(signal)); if (generation!==this.generation || signal.aborted) throw Error('Old turn observation ignored.'); return value; }
    finally { if (generation===this.generation) this.publish({loading:false}); }
  }
  async activities(next: boolean) {
    const generation=this.generation;
    const turn=this.turn; if (!turn) throw Error('Select a turn first.');
    const after=next ? this.next ?? undefined : undefined;
    if (next && !after) throw Error('No next activity page.');
    const page=await this.read(signal=>this.client.nativeActivities(turn.task.id,{after,limit:20},signal));
    if (generation!==this.generation) throw Error('Old turn observation ignored.');
    parseNativeActivityPage(page,turn.task.id,after ?? null);
    this.next=page.nextCursor; this.bodies.clear();
    this.publish({panel:'activity',activities:page.activities,activityStale:false,hasMore:page.nextCursor!==null,detail:null});
  }
  async detail(number: number) {
    const generation=this.generation;
    const header=this.state?.activities[number-1]; if (!header) throw Error('Choose a reference from the displayed activity page.');
    if (!header.detail || header.phase==='redacted') { this.publish({panel:'detail',textPage:1,detail:{title:header.toolName??header.kind,text:'No public body is available.',truncated:false,redacted:true}}); return; }
    let data=this.bodies.get(header.id);
    if (!data) {
      data=await this.read(signal=>this.client.nativeActivity(header.id,signal));
      if (generation!==this.generation) throw Error('Old turn observation ignored.');
      parseNativeActivityBody(data,header);
      if (this.bodies.size===4) this.bodies.delete(this.bodies.keys().next().value!);
      this.bodies.set(header.id,data);
    }
    this.publish({panel:'detail',textPage:1,detail:{title:header.toolName??header.kind,text:data.body?.content ?? 'No public body is available.',truncated:data.body?.truncated??false,redacted:data.body===null}});
  }
  async reply() {
    const generation=this.generation;
    const turn=this.turn; if (!turn || turn.assistant.state!=='available') throw Error('Final reply is not available.');
    const ref=turn.assistant.contentRef;
    const detail=await this.read(signal=>this.client.conversationDetail(turn.conversationId,turn.id,ref.id,signal));
    if (detail.id!==ref.id || detail.kind!==ref.kind || typeof detail.content!=='string' || utf8Bytes(detail.content)>MAX_DETAIL_BYTES) throw Error('Reply detail does not belong to the selected turn.');
    // Typed finals have a digest; legacy final details still require the exact bound route/reference.
    await readCanonicalFinal(turn,detail.content);
    if (generation!==this.generation) throw Error('Old turn observation ignored.');
    this.finalContent=detail.content; this.updateHost(); await this.stream?.refresh();
    if (generation!==this.generation) throw Error('Old turn observation ignored.');
    this.publish({panel:'reply',textPage:1,detail:{title:'Final reply',text:detail.content,truncated:false,redacted:false}});
  }
  back() { this.publish({panel:'body',textPage:null,detail:null}); }
  page(number: number) { if (!this.state || number > observationPage(this.state).pages) throw Error('Text page is outside the displayed body.'); this.publish({textPage:number}); }
  dispose() {
    this.generation++; this.lifetime.abort(); this.lifetime=new AbortController(); this.unsubscribe?.(); this.unsubscribe=undefined;
    this.stream?.dispose(); this.stream=null; this.turn=null; this.state=null; this.visible=false; this.bodies.clear(); this.finalContent=undefined;
  }
}
