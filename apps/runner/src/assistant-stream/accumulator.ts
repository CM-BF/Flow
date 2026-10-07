import { createHash, type Hash } from 'node:crypto';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { ASSISTANT_ATTEMPT_BYTES, ASSISTANT_PATCH_BYTES, type AssistantStreamData, type AssistantStreamMarker } from '../../../../packages/contracts/src/assistant-stream.js';
import { sealPatches, utf8Prefix } from './patch-buffer.js';
const hash = (text:string) => createHash('sha256').update(text).digest('hex');
type Phase = AssistantStreamData['phase'];
type Reason = AssistantStreamData['reason'];
interface Block {
  session:string; message:string; index:number; source:string; id:string;
  content:string; sent:number; sentBytes:number; prefixHash:Hash; revision:number; phase:Phase; reason:Reason; dirty:boolean; truncated:boolean; verified:boolean;
}
/** Maps only root text. Missing/ambiguous native identity never creates a guessed block. */
export class AssistantTextAccumulator {
  private session: string | undefined;
  private current: string | undefined;
  private activeIndex: number | undefined;
  private blocks = new Map<string,Block>();
  private wireBlocks = new Map<string,Block>();
  private seen = new Map<string,string>();
  private bytes=0;
  private stopped=false;
  private tools=new Set<string>();
  private markers:AssistantStreamMarker[]=[];
  private lastSource='';
  /** Called before the original SDK tool frame is forwarded/persisted. */
  before(frame:SDKMessage):(AssistantStreamData|AssistantStreamMarker)[] {
    if (this.stopped || !('parent_tool_use_id' in frame) || frame.parent_tool_use_id!==null || !('session_id' in frame) || !frame.session_id || !('uuid' in frame) || !frame.uuid) return [];
    const tools=frame.type==='stream_event' && frame.event.type==='content_block_start' && frame.event.content_block.type==='tool_use'
      ? [frame.event.content_block.id] : frame.type==='assistant' ? frame.message.content.filter(block=>block.type==='tool_use').map(block=>block.id) : [];
    const fresh=tools.filter(id=>!this.tools.has(id));
    if (!fresh.length) return [];
    if (this.tools.size+fresh.length>256) { this.stopped=true; return this.invalidate('truncated'); }
    const output:(AssistantStreamData|AssistantStreamMarker)[]=this.flush();
    for (const tool of fresh) { this.tools.add(tool); output.push(this.marker(frame.session_id,frame.uuid,'tool-boundary',tool,null)); }
    return output;
  }
  drainMarkers():AssistantStreamMarker[] { const markers=this.markers;this.markers=[];return markers; }
  private marker(session:string,source:string,kind:AssistantStreamMarker['kind'],toolUseId:string|null,reason:Reason):AssistantStreamMarker {
    return {type:'assistant-stream-marker',markerId:hash(JSON.stringify([session,source,kind,toolUseId,reason])),nativeSessionId:session,sourceMessageId:source,kind,toolUseId,reason};
  }
  private unavailable(reason:Reason):void {
    if(this.session && this.lastSource) this.markers.push(this.marker(this.session,this.lastSource,'unavailable',null,reason));
  }
  observe(frame:SDKMessage): AssistantStreamData[] {
    if (this.stopped || (frame.type!=='stream_event' && frame.type!=='assistant') || frame.parent_tool_use_id!==null) return [];
    if (!frame.uuid || !frame.session_id) return [];
    if (this.session && this.session!==frame.session_id) throw new Error('Assistant stream changed native session.');
    this.session=frame.session_id; this.lastSource=frame.uuid;
    const fingerprint=hash(JSON.stringify(frame));
    const prior=this.seen.get(frame.uuid);
    if (prior) { if(prior===fingerprint) return []; this.unavailable('source-mismatch'); return this.invalidate('source-mismatch'); }
    if (this.seen.size>=16384) { this.stopped=true; return this.invalidate('truncated'); }
    this.seen.set(frame.uuid,fingerprint);
    if (frame.type==='assistant') return this.complete(frame);
    const event=frame.event;
    if (event.type==='message_start') {
      if(this.current!==undefined) this.unavailable('source-gap');
      const pending=this.invalidate('source-gap');
      this.current=event.message.id; this.activeIndex=undefined;
      return pending;
    }
    if (event.type==='content_block_start') {
      this.activeIndex=event.index;
      if (!this.current || event.content_block.type!=='text') return [];
      const key=JSON.stringify([this.session,this.current,event.index]);
      if (this.blocks.has(key)) return this.invalidate('source-gap');
      if (this.blocks.size>=256) { this.stopped=true; return this.invalidate('truncated'); }
      const block:Block={session:this.session,message:this.current,index:event.index,source:frame.uuid,id:hash(key),content:'',sent:0,sentBytes:0,prefixHash:createHash('sha256'),revision:0,phase:'streaming',reason:null,dirty:false,truncated:false,verified:false};
      this.blocks.set(key,block);
      return this.append(block,event.content_block.text,frame.uuid);
    }
    if (event.type==='content_block_delta' && event.delta.type==='text_delta') {
      const block=this.block(event.index);
      if (!block) { this.unavailable('source-gap'); return this.invalidate('source-gap'); }
      if (block.phase!=='streaming') return this.change(block,'incomplete','source-gap');
      return this.append(block,event.delta.text,frame.uuid);
    }
    if (event.type==='content_block_stop') {
      const block=this.block(event.index);
      if (this.activeIndex===event.index) this.activeIndex=undefined;
      if (!block || block.phase!=='streaming') return [];
      block.source=frame.uuid;
      if(block.content!==''&&!block.verified) return this.change(block,'incomplete','source-gap');
      return this.change(block,'block-complete',null);
    }
    if (event.type==='message_stop') { const pending=this.invalidate('source-gap'); this.current=undefined; this.activeIndex=undefined; return pending; }
    return [];
  }
  flush():AssistantStreamData[] { return [...this.blocks.values()].flatMap(block=>this.seal(block)); }
  finish():AssistantStreamData[] {
    if(this.current!==undefined) this.unavailable('stream-ended');
    const events=this.invalidate('stream-ended');
    this.stopped=true;
    return [...events,...this.flush()];
  }
  private block(index:number):Block|undefined { return this.blocks.get(JSON.stringify([this.session,this.current,index])); }
  private append(block:Block,text:string,source:string):AssistantStreamData[] {
    block.source=source;
    if (text.includes('\0') || Buffer.from(text).toString('utf8')!==text) return this.change(block,'incomplete','source-mismatch');
    const remaining=ASSISTANT_ATTEMPT_BYTES-this.bytes;
    const accepted=utf8Prefix(text,remaining);
    block.content+=accepted; this.bytes+=Buffer.byteLength(accepted);
    block.dirty ||= accepted.length>0;
    if (accepted.length<text.length) { block.truncated=true; return this.change(block,'incomplete','truncated'); }
    return Buffer.byteLength(block.content.slice(block.sent))>=ASSISTANT_PATCH_BYTES ? this.seal(block) : [];
  }
  private change(block:Block,phase:Phase,reason:Reason):AssistantStreamData[] {
    if (block.phase===phase && block.reason===reason) return [];
    block.phase=phase; block.reason=reason; block.dirty=true;
    if (reason==='truncated') block.truncated=true;
    if (phase==='incomplete') this.unavailable(reason);
    return this.seal(block);
  }
  private invalidate(reason:Reason):AssistantStreamData[] {
    return [...this.blocks.values()].filter(block=>block.phase==='streaming').flatMap(block=>this.change(block,'incomplete',reason));
  }
  private complete(frame:Extract<SDKMessage,{type:'assistant'}>):AssistantStreamData[] {
    const patches:AssistantStreamData[]=[];
    for (const uuid of frame.supersedes??[]) {
      const block=this.wireBlocks.get(uuid);
      if (block) patches.push(...this.change(block,'superseded','superseded'));
      else this.unavailable('source-gap');
    }
    const blocks=[...this.blocks.values()].filter(block=>block.message===frame.message.id);
    const text=frame.message.content.filter(part=>part.type==='text');
    if (!text.length) return patches;
    // The fixed SDK emits one complete content block before its block_stop.
    // Never infer a stream index from the singleton content array position.
    const block=blocks.find(candidate=>candidate.index===this.activeIndex && candidate.message===this.current) ?? (blocks.length===1?blocks[0]:undefined);
    if (!block || text.length!==1) { this.unavailable('source-mismatch'); return [...patches,...blocks.filter(value=>value.phase!=='superseded').flatMap(value=>this.change(value,'incomplete','source-mismatch'))]; }
    this.wireBlocks.set(frame.uuid,block);
    if (frame.aborted) return [...patches,...this.change(block,'incomplete','aborted')];
    if (!block.truncated && block.content!==text[0]!.text) patches.push(...this.change(block,'incomplete','source-mismatch'));
    else if(!block.truncated) block.verified=true;
    return patches;
  }
  private seal(block:Block):AssistantStreamData[] {
    return sealPatches(block, () => ({type:'assistant-stream',streamId:block.id,nativeSessionId:block.session,
      nativeMessageId:block.message,parentToolUseId:null,source:'claude.sdk.stream',sourceMessageId:block.source,blockIndex:block.index}));
  }
}
