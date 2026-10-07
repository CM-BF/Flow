import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { CodexAssistantStream } from '../../../../apps/runner/src/native-harness/codex/stream.js';
import { applyPatchPage, emptyPatchState, readStreamMetadata, validateMetadataPartition } from './patches.js';
it('decodes public Codex patches with their channel and rejects stale/source/turn forgery', async () => {
  const stream = new CodexAssistantStream(), value={kind:'reasoning-summary' as const,threadId:'thread',turnId:'turn',itemId:'item',index:0,delta:'公开🙂'};
  const first=stream.accept(value)[0]!, last=stream.accept({...value,delta:'',completedText:value.delta})[0]!;
  const {type,text,fromBytes,...header}=last;
  const ref={...header,id:last.streamId,taskId:'task',attemptId:'attempt',firstSequence:1,lastSequence:2,bytes:Buffer.byteLength(value.delta),createdAt:'2026-10-07T00:00:00Z',updatedAt:'2026-10-07T00:00:00Z',status:'block-complete'};
  const metadata=await readStreamMetadata({taskId:'task',attemptId:'attempt',taskStatus:'running',taskUpdatedAt:ref.updatedAt,blocks:[ref],nextCursor:null,finalMessageId:null,settlement:null},'task');
  validateMetadataPartition(metadata);
  const patches=[first,last].map((p,i)=>({...p,taskId:'task',attemptId:'attempt',eventId:'event'+i,sequence:i+1,createdAt:ref.createdAt}));
  const page={taskId:'task',attemptId:'attempt',patches,nextCursor:2,hasMore:false};
  const state=(await applyPatchPage(emptyPatchState('task','attempt'),page,0,metadata.blocks)).state;
  expect(state.blocks[0]).toMatchObject({content:value.delta,channel:'reasoning-summary',nativeTurnId:'turn'});
  expect(state.blocks[0]!.prefixDigest).toBe(createHash('sha256').update(value.delta).digest('hex'));
  for(const delta of [{attemptId:'old'},{source:'claude.sdk.stream'},{nativeTurnId:'foreign'},{channel:'text'}])
    await expect(applyPatchPage(emptyPatchState('task','attempt'),{...page,patches:[{...patches[0],...delta},patches[1]]},0,metadata.blocks)).rejects.toThrow();
});
