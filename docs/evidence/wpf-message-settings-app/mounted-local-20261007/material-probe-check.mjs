import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const file='/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/apps/web/test/conversation-recovery.fixture.ts';
const source=readFileSync(file,'utf8');
const match=source.match(/const materialProbeSource = String\.raw`([\s\S]*?)`;/);
assert.ok(match); const actual=match[1]; const checks=[];
function setup() {
 const timers=new Map(),events=new Map();let next=0;
 const context=vm.createContext({structuredClone,setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}});
 vm.runInContext(actual.replaceAll('export ','')+'\nglobalThis.api={arm,snapshot,settle,holdValidated,dispose,observeReady};',context);
 return {api:context.api,timers,events};
}
const x=setup();
x.api.arm('failure');const bad=x.api.holdValidated(new AbortController().signal);x.api.settle('failed');await assert.rejects(bad,/failed/);assert.equal(x.api.snapshot().rows[0].returned,false);assert.equal(x.timers.size,0);checks.push('actual source failure rejects and retires timer');
const abort=new AbortController();x.api.arm('cancel');let settled=false;const late=x.api.holdValidated(abort.signal).then(()=>{settled=true;});abort.abort();await Promise.resolve();assert.equal(settled,false);assert.equal(x.api.snapshot().rows[1].abortObserved,true);assert.equal(x.api.snapshot().pending,true);x.api.settle('released');await late;assert.equal(x.api.snapshot().rows[1].returned,true);assert.equal(x.timers.size,0);checks.push('cancel ignores abort until explicit late settlement, bounded timer remains');
x.api.arm('success');const good=x.api.holdValidated(new AbortController().signal);x.api.settle('released');await good;assert.equal(x.api.snapshot().rows[2].returned,true);assert.throws(()=>x.api.arm('success'),/Invalid/);x.api.dispose();assert.equal(x.events.size,0);assert.equal(x.timers.size,0);checks.push('success and exact three-row cap/dispose');
const y=setup();y.api.arm('failure');const pending=y.api.holdValidated(new AbortController().signal);y.api.dispose();await assert.rejects(pending,/disposed/);assert.equal(y.timers.size,0);assert.equal(y.events.size,0);assert.throws(()=>y.api.arm('failure'));checks.push('dispose rejects pending and removes timer/listener');
const z=setup();z.api.arm('cancel');const timeout=z.api.holdValidated(new AbortController().signal);assert.equal(z.timers.size,1);[...z.timers.values()][0]();await assert.rejects(timeout,/timeout/);assert.equal(z.timers.size,0);z.api.dispose();checks.push('controlled deadline callback rejects even ignore-abort cancel');
const observed=setup();for(let n=0;n<8;n++)observed.api.observeReady({id:String(n),name:'file',reference:{version:1}});assert.throws(()=>observed.api.observeReady({id:'9',name:'file'}),/bound/);assert.equal(observed.api.snapshot().ready.length,8);observed.api.dispose();checks.push('actual ready identity witness is bounded to eight records');
console.log(JSON.stringify({state:'PASS',checks,sourceSha256:createHash('sha256').update(source).digest('hex'),probeSha256:createHash('sha256').update(actual).digest('hex'),scope:'actual fixture JS extracted, controlled clock; not mounted or browser'}));
