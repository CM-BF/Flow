import { describe, expect, it } from 'vitest';
import type { ConversationTurn } from '@flow/contracts';
import { projectBodySegments, readCanonicalFinal } from './presentation.js';
import type { StreamState } from './projection.js';
const at = '2026-10-06T10:00:00Z';
const turn: ConversationTurn = { id:'turn', conversationId:'chat', number:1, createdAt:at, user:{role:'user',text:'Hi'},
  task:{id:'task',title:'Chat',harness:'claude',status:'running',verificationStatus:'pending',createdAt:at,updatedAt:at},
  assistant:{state:'pending',reason:'execution-pending'}, effective:{model:null,thinking:'unknown',tools:null,source:null},telemetry:{kind:'execution',taskId:'task',title:'Execution'} };
const state: StreamState = {scope:{connectionId:'center',viewId:'view',conversationId:'chat',turnId:'turn',taskId:'task'}, enabled:true,visible:true,online:true,loading:false,stale:false,metadata:null,patches:null,final:null,hasMore:false,error:null,retryAt:null};
describe('neutral assistant body presentation', () => {
  it('does not invent a completed reply from pending telemetry or mix another turn', () => {
    expect(projectBodySegments(turn,state)).toEqual([]);
    expect(() => projectBodySegments({...turn,id:'other'},state)).toThrow('turn');
  });
  it('shows a final preview without treating it as sufficient replacement evidence', async () => {
    const t: ConversationTurn = {...turn,assistant:{state:'available',role:'assistant',messageId:'final',text:'Preview',truncated:true,
      contentRef:{id:'detail',title:'Reply',kind:'detail',taskId:'task',attemptId:'attempt'},
      source:{kind:'assistant-final',source:'claude.sdk.result',taskId:'task',attemptId:'attempt',nativeSessionId:'session',messageId:'final',eventId:'event',sourceMessageId:'source',contentDigest:'a'.repeat(64),detailId:'detail'}}};
    expect(await readCanonicalFinal(t)).toBeNull();
    expect(projectBodySegments(t,state)).toMatchObject([{id:'final',kind:'final',text:'Preview',truncated:true,phase:'final',taskStatus:'running'}]);
  });
});
