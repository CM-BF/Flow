import { expect, test } from 'vitest';
import { LARGE_CONTRACT } from './contract.js';
import { validateWindow, validateFinal, validatePersistentSessions, validateWindowSamples, type CaseResult } from './proof.js';
import type { Observation } from './process.js';
function sample() {
  const taskIds=Array.from({length:128},(_,i)=>'task-'+i);
  const result: CaseResult={id:'eight-by-sixteen',taskIds,cancelled:[],gate:[],windowComplete:true,settledByDeadline:true,
    measureSentMs:90090,final:[],sessions:[],events:[],totals:{tasks:128,attempts:128,sessions:128}};
  const records: Observation[]=[];
  const add=(kind:string,childMs:number,value:Record<string,unknown>)=>records.push({kind,childMs,pid:1,receivedMs:childMs+90000,caseId:result.id,...value});
  add('window-start',100,{beganMs:100});
  for(let i=0;i<128;i++) {
    const id={taskId:taskIds[i],attemptId:'attempt-'+i,ownerVersion:1,runnerId:'runner-'+Math.floor(i/16)};
    result.gate.push({task_id:id.taskId,status:'running',live:true,completed_at:null,attempt_id:id.attemptId,current_attempt_id:id.attemptId,owner_version:1,task_version:1,runner_id:id.runnerId,native_session_id:'session-'+i,session_id:'session-'+i,session_runner_id:id.runnerId,session_harness:'fixture',session_task_id:id.taskId});
    add('adapter-ready',50,id);add('claim',0,id);add('adapter-enter',1,id);add('barrier-released',100,{...id,waitingAtMs:2,releasedAtMs:100});add('adapter-end',6101,{...id,interrupted:false});add('heartbeat',1000,{...id,action:'continue'});
    for(const [ordinal,ack] of [[1,200],[2,5200]]) {
      add('event-ack',ack!-10,{...id,emissionOrdinal:ordinal,acknowledgement:{accepted:1,lastSequence:ordinal},events:[{type:'message',sequence:ordinal,id:`message-${i}-${ordinal}`,digest:'digest'}]});
      add('emit-ack',ack!,{...id,emissionOrdinal:ordinal,startedChildMs:ack!-20});
    }
    add('event-ack',6200,{...id,acknowledgement:{accepted:1,lastSequence:3},events:[{type:'completed',outcome:'succeeded',sequence:3,id:'done-'+i,digest:'digest'}]});
    result.final!.push({id:id.taskId,status:'succeeded',verification_status:'passed',attempt_id:id.attemptId,owner_version:1,runner_id:id.runnerId,native_session_id:'session-'+i,completed_at:'done',last_sequence:3});
    result.sessions!.push({id:'session-'+i,harness:'fixture',runner_id:id.runnerId,active_task_id:null});
    for(let sequence=1;sequence<=3;sequence++)result.events!.push({attempt_id:id.attemptId,sequence,event_id:sequence===3?'done-'+i:`message-${i}-${sequence}`,digest:'digest'});
  }
  const acks=records.filter(x=>x.kind==='event-ack');
  const sessionAcks=taskIds.map((taskId,i)=>({kind:'event-ack',caseId:result.id,pid:1,receivedMs:0,taskId,attemptId:'attempt-'+i,ownerVersion:1,
    acknowledgement:{accepted:0,lastSequence:1},events:[{type:'session',nativeSessionId:'session-'+i}]}));
  records.push(...sessionAcks);
  return {result,records,acks,sessionAcks};
}
test('all128 ACK envelopes use runner monotonic time, not the delayed parent receipt clock',()=>{
  const {result,records}=sample();validateWindow(result,records,LARGE_CONTRACT);
  expect(result.activity?.logicalAdapterPeak).toBe(128);expect(result.activity?.allAdapterOverlapMs).toBe(6100);
  expect(result.activity?.commonAckSpanMs).toBe(5000);expect(result.activity?.spans).toHaveLength(128);
});
test('barrier occupancy or ACKs only outside the window cannot establish sustained work',()=>{
  const {result,records}=sample();
  expect(()=>validateWindow(result,records.filter(x=>x.kind!=='emit-ack'),LARGE_CONTRACT)).toThrow('missing_window_emit');
  const last=records.find(x=>x.kind==='emit-ack'&&x.attemptId==='attempt-0'&&x.emissionOrdinal===2)!;
  last.childMs=6200;
  expect(()=>validateWindow(result,records,LARGE_CONTRACT)).toThrow('missing_sustained_window_emissions');
});
test('a short ACK span or unrelated ACK ordinal does not prove the planned sustained work',()=>{
  const {result,records}=sample();
  const last=records.find(x=>x.kind==='emit-ack'&&x.attemptId==='attempt-0'&&x.emissionOrdinal===2)!;
  last.childMs=3000;
  expect(()=>validateWindow(result,records,LARGE_CONTRACT)).toThrow('insufficient_window_ack_span');
  last.childMs=5200;last.emissionOrdinal=999;
  expect(()=>validateWindow(result,records,LARGE_CONTRACT)).toThrow('emit_not_bound_to_event_ack');
});
test('persisted event id sequence digest and ACK ownerVersion all participate in completion proof',()=>{
  const {result,acks}=sample();validateFinal(result,acks);
  acks[0]!.ownerVersion=2;expect(()=>validateFinal(result,acks)).toThrow('event_digest_not_bound_to_ack');
});
test('an extra DB attempt fails even when all128 known claims and sessions appear complete',()=>{
  const {result,acks,sessionAcks}=sample();validatePersistentSessions(result,[...acks,...sessionAcks],LARGE_CONTRACT);
  result.totals!.attempts=129;
  expect(()=>validatePersistentSessions(result,[...acks,...sessionAcks],LARGE_CONTRACT)).toThrow('unexpected_total_attempts');
});
test('terminal session binding and accepted counts cannot be inferred from128 fixture records',()=>{
  const {result,acks,sessionAcks}=sample();result.sessions![0]!.active_task_id='task-0';
  expect(()=>validatePersistentSessions(result,[...acks,...sessionAcks],LARGE_CONTRACT)).toThrow('final_session_identity_mismatch');
  result.sessions![0]!.active_task_id=null;(acks[0]!.acknowledgement as {accepted:number}).accepted=0;
  expect(()=>validatePersistentSessions(result,[...acks,...sessionAcks],LARGE_CONTRACT)).toThrow('accepted_count_not_bound_to_persistence');
});

function sampled() {
  const state=sample();
  for(const [start,end] of [[90200,90220],[94500,94520]]) state.records.push({kind:'attempt-snapshot',caseId:state.result.id,pid:2,receivedMs:end!,
    queryStartedMs:start,queryEndedMs:end,rows:structuredClone(state.result.gate)});
  return state;
}
test('only DB queries wholly inside IPC-bounded parent window contribute to sampled ownership proof',()=>{
  const {result,records}=sampled();
  records.push({kind:'attempt-snapshot',caseId:result.id,pid:2,receivedMs:96095,queryStartedMs:96080,queryEndedMs:96095,rows:[]});
  validateWindowSamples(result,records,LARGE_CONTRACT);
  expect(result.sampledOwnership).toMatchObject({conservativeEndMs:96090,validatedSamples:2,conservativeSampleSeparationMs:4280});
  expect(result.sampledOwnership?.excludedBoundarySamples).toHaveLength(1);
});
test('zero samples and an intermediate expired lease or changed owner cannot produce a successful window',()=>{
  const state=sample();expect(()=>validateWindowSamples(state.result,state.records,LARGE_CONTRACT)).toThrow('insufficient_window_samples');
  const {result,records}=sampled();const row=(records.find(x=>x.kind==='attempt-snapshot')!.rows as Record<string,unknown>[])[0]!;
  row.live=false;expect(()=>validateWindowSamples(result,records,LARGE_CONTRACT)).toThrow('window_sample_not_live_and_fenced');
  row.live=true;row.owner_version=2;expect(()=>validateWindowSamples(result,records,LARGE_CONTRACT)).toThrow('window_sample_not_live_and_fenced');
});

test('two adjacent slow queries cannot turn SQL execution time into four seconds of sampled separation',()=>{
  const {result,records}=sample();
  for(const [start,end] of [[90110,93000],[93001,96000]]) records.push({kind:'attempt-snapshot',caseId:result.id,pid:2,receivedMs:end!,queryStartedMs:start,queryEndedMs:end,rows:structuredClone(result.gate)});
  expect(()=>validateWindowSamples(result,records,LARGE_CONTRACT)).toThrow('insufficient_window_sample_span');
});
