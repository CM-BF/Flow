import { mkdtemp, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport } from '../../codex/types.js';
import { fileURLToPath } from 'node:url';
import { createCodexAdapter } from './adapter.js';
import { CodexAssistantStream } from './stream.js';
const delta = { kind:'text' as const,threadId:'thread',turnId:'turn',itemId:'item',index:null,delta:'中文🙂' };
it('keeps source/channel/turn identity and rejects changed completion, foreign turn and post-completion text', () => {
  const stream = new CodexAssistantStream(); const first = stream.accept(delta)[0]!;
  expect(first).toMatchObject({source:'codex.app-server.stream',nativeTurnId:'turn',channel:'text',revision:1});
  expect(() => stream.accept({...delta,turnId:'foreign'})).toThrow();
  expect(() => stream.accept({...delta,delta:'',completedText:'other'})).toThrow();
  expect(stream.accept({...delta,delta:'',completedText:delta.delta})).toMatchObject([{phase:'block-complete',text:'',revision:2}]);
  expect(() => stream.accept(delta)).toThrow();
  const other = new CodexAssistantStream().accept({...delta,turnId:'other'})[0]!; expect(other.streamId).not.toBe(first.streamId);
});
it('enforces total decoded text and separates two explicitly published reasoning channels', () => {
  const stream = new CodexAssistantStream(); const a = stream.accept({...delta,kind:'reasoning-summary',index:0})[0]!;
  const b = stream.accept({...delta,kind:'reasoning-text',index:0})[0]!; expect(a.streamId).not.toBe(b.streamId);
  expect(() => stream.accept({...delta,delta:'x'.repeat(1048576)})).toThrow('byte limit');
  expect(() => new CodexAssistantStream().accept({...delta,delta:'\ud800'})).toThrow();
});
it.each([32,512])('publishes session then public patches and one final from %i real synthetic JSONL fragments', async count => {
  const root = await mkdtemp(join(tmpdir(),'flow-c02-public-')); const identity = await lstat(root); let child: CodexTransport | undefined;
  const events: RunnerEventData[] = [];
  const profile = {harness:'codex' as const,adapterVersion:'codex-app-server-0.154.0-v1' as const,model:'synthetic-model',reasoningEffort:null,
    serviceTier:null,serviceTierForTurn:'default' as const,access:'none' as const,approvalPolicy:'never' as const,sandboxMode:'read-only' as const,hostLimits:{wallTimeMs:3000,maxOutputBytes:16384}};
  try {
    const adapter = createCodexAdapter(profile, options => child = createCodexTransport({spawn:{executable:process.execPath,args:[fileURLToPath(new URL('./peer.mjs',import.meta.url)),`stream:${count}`],cwd:root,environment:{LANG:'C'}},
      initialize:{clientInfo:{name:'public-stream-fixture',title:null,version:'1'},capabilities:null},signal:options.signal,limits:{terminateMs:50,killMs:50}}));
    await adapter.run({task:{title:'Public stream',prompt:'Synthetic',harness:'codex',executionProfile:{id:'profile',runnerId:'runner',configDigest:'a'.repeat(64)}},workingDirectory:root,signal:new AbortController().signal,
      async assertOwnership(){},async emit(event){events.push(event)},async waitForDecision(){throw Error('unused')}} as HarnessContext);
    const patches = events.filter(event => event.type==='assistant-stream');
    expect(events[0]?.type).toBe('session'); expect(events.filter(event=>event.type==='session')).toHaveLength(1);
    expect(patches.filter(p=>p.channel==='text').map(p=>p.text).join('')).toBe('中文🙂'.repeat(512));
    expect(patches.filter(p=>p.channel==='reasoning-summary').map(p=>p.text).join('')).toBe('公开摘要🙂');
    expect(patches.filter(p=>p.phase==='block-complete')).toHaveLength(2);
    expect(events.filter(event=>event.type==='assistant-final')).toHaveLength(1); expect(events.at(-3)?.type).toBe('assistant-final');
    expect(JSON.stringify(events)).not.toContain('private-server'); expect(child!.snapshot().state).toBe('closed');
  } finally {
    if(child) expect((await child.close()).child).toBe('confirmed-exited');
    const current = await lstat(root); expect([current.dev,current.ino]).toEqual([identity.dev,identity.ino]); await rm(root,{recursive:true});
  }
});
