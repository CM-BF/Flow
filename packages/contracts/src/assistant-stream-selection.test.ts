import {expect,it} from 'vitest';
import {assistantStreamProtocol,assistantStreamSelectionSchema,assistantStreamSelectionQuery} from './assistant-stream.js';
it('requires one exact selected-read header and keeps old unknown/v1/v2 semantics',()=>{
 for(const p of ['patch-v1','patch-v2','patch-select-v1'])expect(assistantStreamProtocol(['X-Flow-Assistant-Stream',p])).toBe(p);
 for(const h of [[],['X-Flow-Assistant-Stream','patch-v3'],['X-Flow-Assistant-Stream','patch-select-v1','x-flow-assistant-stream','patch-select-v1']])expect(assistantStreamProtocol(h)).toBeNull();
});
it('has finite immutable selections, rejects ambiguous block/text and oversized identities',()=>{
 const text=assistantStreamSelectionQuery(undefined,undefined);expect(text).toEqual({kind:'text'});expect(Object.isFrozen(text)).toBe(true);
 expect(assistantStreamSelectionQuery('block','a'.repeat(64))).toEqual({kind:'block',streamId:'a'.repeat(64)});
 for(const [kind,id] of [['text','a'.repeat(64)],['block',undefined],['all',undefined],['block','A'.repeat(64)]])expect(()=>assistantStreamSelectionQuery(kind,id)).toThrow();
 expect(assistantStreamSelectionSchema.safeParse({kind:'text',streamId:'a'.repeat(64)}).success).toBe(false);
});
