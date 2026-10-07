import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { ASSISTANT_FLUSH_MS, type AssistantStreamData, type AssistantStreamMarker } from '../../../../packages/contracts/src/assistant-stream.js';
import { AssistantTextAccumulator } from './accumulator.js';
export { AssistantTextAccumulator } from './accumulator.js';
export type AssistantStreamItem = {kind:'frame';frame:SDKMessage}|{kind:'patch';patch:AssistantStreamData}|{kind:'marker';patch:AssistantStreamMarker};
/** One pending SDK next() and one timer. Yield backpressure bounds both writes and read-ahead. */
export async function* coalesceAssistantStream(source:AsyncIterable<SDKMessage>,signal:AbortSignal):AsyncGenerator<AssistantStreamItem> {
  const accumulator=new AssistantTextAccumulator();
  const iterator=source[Symbol.asyncIterator]();
  let pending=iterator.next();
  // Attach rejection immediately, including while the caller is persisting a patch.
  let next=pending.then(value=>({kind:'next' as const,value}));
  void next.catch(()=>{});
  let finished=false;
  let flushAt=Date.now()+ASSISTANT_FLUSH_MS;
  try {
    while(true) {
      signal.throwIfAborted();
      const result=await nextOrTick(next,signal,Math.max(0,flushAt-Date.now()));
      if (result.kind==='tick') { for(const patch of accumulator.flush()) yield {kind:'patch',patch}; flushAt=Date.now()+ASSISTANT_FLUSH_MS; continue; }
      if (result.value.done) { finished=true; break; }
      const frame=result.value.value;
      // Session/init and all existing observations are handled before dependent text patches.
      for(const record of accumulator.before(frame)) yield record.type==='assistant-stream' ? {kind:'patch',patch:record} : {kind:'marker',patch:record};
      // A result may conditionally seal this attempt: persist every earlier SDK text patch first.
      if (frame.type==='result') {
        for(const patch of accumulator.flush()) yield {kind:'patch',patch};
        for(const marker of accumulator.drainMarkers()) yield {kind:'marker',patch:marker};
      }
      yield {kind:'frame',frame};
      for(const patch of accumulator.observe(frame)) yield {kind:'patch',patch};
      if (Date.now()>=flushAt) { for(const patch of accumulator.flush()) yield {kind:'patch',patch}; flushAt=Date.now()+ASSISTANT_FLUSH_MS; }
      for(const marker of accumulator.drainMarkers()) yield {kind:'marker',patch:marker};
      pending=iterator.next(); next=pending.then(value=>({kind:'next' as const,value})); void next.catch(()=>{});
    }
    for(const patch of accumulator.finish()) yield {kind:'patch',patch};
    for(const marker of accumulator.drainMarkers()) yield {kind:'marker',patch:marker};
  } catch (error) {
    // Ordinary provider failure can persist a known prefix; abort/ownership loss cannot promise a flush.
    if (!signal.aborted) { for(const patch of accumulator.finish()) yield {kind:'patch',patch}; for(const marker of accumulator.drainMarkers()) yield {kind:'marker',patch:marker}; }
    throw error;
  } finally {
    // Never await a provider iterator that ignores abort; adapter owns close()/abort.
    if (!finished) { const closing=iterator.return?.(); if(closing) void closing.catch(()=>{}); }
  }
}
async function nextOrTick<T>(next:Promise<T>,signal:AbortSignal,delay:number):Promise<T|{kind:'tick'}> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  let abort=()=>{};
  const tick=new Promise<{kind:'tick'}>((resolve,reject)=>{
    timer=setTimeout(()=>resolve({kind:'tick'}),delay);
    abort=()=>reject(signal.reason??new Error('Assistant stream interrupted.'));
    signal.addEventListener('abort',abort,{once:true}); if(signal.aborted) abort();
  });
  try { return await Promise.race([next,tick]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort',abort); }
}
