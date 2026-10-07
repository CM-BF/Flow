import { afterEach, expect, it, vi } from 'vitest';
import { FlowClient } from './index.js';
import { decodeConversationCreated, decodeConversationQueueAccepted, decodeConversationTurnAccepted } from './conversation-acknowledgement.js';
const pin = { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) };
const input = { title: 'Native', harness: 'codex' as const, executionProfile: pin, requested: { model: 'runner-default', thinking: 'unknown' as const, tools: 'none' as const } };
const at = '2026-10-07T00:00:00Z';
const conversation = { ...input, id: 'conversation', revision: 0, createdAt: at, updatedAt: at };
const caps = { followUp: true, queue: true, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false };
afterEach(() => vi.unstubAllGlobals());
it('confirms native creation and rejects a rewritten harness/pin', () => { expect(decodeConversationCreated({ conversation, capabilities: caps, replayed: false }, input).conversation.harness).toBe('codex'); expect(() => decodeConversationCreated({ conversation: { ...conversation, harness: 'claude' }, capabilities: caps, replayed: true }, input)).toThrow(); });
it('propagates the fixed codec to list, direct, context and all queue controls', async () => {
 const seen: string[] = []; vi.stubGlobal('fetch', vi.fn(async (_url, init) => { seen.push(new Headers(init.headers).get('X-Flow-Conversation')!); return new Response('{}'); }));
 const c = new FlowClient({ baseUrl: 'http://unit.invalid', token: 'fixture', conversationProtocol: 'native-v1' });
 await c.conversations(); await c.conversation('c'); await c.conversationTurns('c'); await c.conversationDetail('c','t','d'); await c.conversationContext('c','x'); await c.conversationQueue('c'); await c.conversationQueueItem('c','i'); await c.cancelConversationQueueItem('c','i',{expectedQueueRevision: 0},'k'); await c.pauseConversationQueue('c',{expectedQueueRevision: 0},'k'); await c.resumeConversationQueue('c',{expectedQueueRevision: 0,expectedTaskId:null},'k');
 expect(seen).toEqual(Array(10).fill('native-v1'));
});
it('validates native enqueue without fabricating Claude message settings', () => { const request={expectedQueueRevision:0,text:'🙂 next'}; const receipt={conversationId:'conversation',queueRevision:1,replayed:false,item:{id:pin.id,conversationId:'conversation',sequence:1,state:'waiting',promoted:null,preview:request.text,truncated:false,createdAt:at,updatedAt:at}}; expect(decodeConversationQueueAccepted(receipt,'conversation',request,true)).toEqual(receipt); expect(() => decodeConversationQueueAccepted({...receipt,item:{...receipt.item,preview:'other'}},'conversation',request,true)).toThrow(); });
it('rejects cross-harness accepted tasks', () => {
 const request={expectedRevision:0,text:'next',mode:'follow-up' as const}; const receipt={conversation:{...conversation,revision:1},replayed:false,turn:{id:'turn',conversationId:'conversation',number:1,createdAt:at,user:{role:'user',text:'next'},task:{id:'task',title:'Native',harness:'claude',createdAt:at,updatedAt:at,status:'queued',verificationStatus:'pending'},telemetry:{kind:'execution',taskId:'task',title:'Execution'},effective:{model:null,thinking:'unknown',tools:'unknown',source:null},assistant:{state:'pending',reason:'execution-pending'}}};
 expect(() => decodeConversationTurnAccepted(receipt,'conversation',request)).toThrow(); receipt.turn.task.harness='codex'; expect(decodeConversationTurnAccepted(receipt,'conversation',request).turn.task.harness).toBe('codex');
});
