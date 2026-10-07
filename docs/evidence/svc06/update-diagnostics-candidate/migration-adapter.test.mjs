import test from 'node:test';
import assert from 'node:assert/strict';
import { assertMigrationState, checkStoreBudget, migrateWithLocks, confirmMigrationRunner } from './migration-adapter.mjs';
const input = { installationDirectory: '/owned-install', repository: '/fixed-source', artifact: { artifactId: 'new' }, retainedArtifact: { artifactId: 'c7b' }, artifactTotalLogicalBytes: 40, expectedSource: { head: 'af51', dirty: false }, expectedWebHost: { operationId: 'old', artifact: { artifactId: 'c7b' } } };
const state = () => ({ source: structuredClone(input.expectedSource), webHost: structuredClone(input.expectedWebHost) });
test('settled c7b is retained; null, foreign, pending and selected-backend states reject', () => {
  assert.doesNotThrow(() => assertMigrationState(state(), input));
  for (const change of [{webHost:null}, {webHost:{artifact:{artifactId:'other'}}}, {pendingWebHost:{}}, {backendArtifact:{artifactId:'new'}}, {source:{head:'other'}}]) assert.throws(() => assertMigrationState({...state(),...change},input));
});
test('the second exact slot fits; missing retained, foreign entries and byte overflow reject', () => {
  const limits = { artifacts: 2, retainedBytes: 100 };
  assert.equal(checkStoreBudget(['c7b'], 40, input, limits), false);
  assert.equal(checkStoreBudget(['c7b','new'], 80, input, limits), true);
  for (const [ids, bytes] of [[[],0],[['other'],1],[['c7b'],61],[['c7b','new'],101]]) assert.throws(() => checkStoreBudget(ids, bytes, input, limits));
});
function harness({present=false, fail=null, recordFailure=false, changedAfter=false}={}) {
  const calls=[], records=new Map(); let reads=0;
  const hit = name => { calls.push(name); if(name===fail) throw Object.assign(new Error('not exposed'),{code:'PRIMARY'}); };
  const lock = name => async (_value, action) => { hit(name+':enter'); try { return await action(); } finally { hit(name+':exit'); } };
  const mod={ preview:{ loadPreviewConfiguration:async()=>{hit('load');return{};}, withPreviewLock:lock('preview'), assertPreviewMarker:async()=>hit('marker') },
    store:{ensureStore:async()=>{hit('store');return '/owned-install/backend-artifacts';},withStoreLock:lock('storelock')} };
  const io={
    fresh:async()=>{hit('fresh');return{files:{digest:changedAfter&&reads++?'changed':'same'}};},
    record:async(name,value)=>{hit('record:'+name);if(recordFailure&&name==='migration-result.json')throw Object.assign(new Error('secondary secret'),{code:'ERECORD'});assert.ok(!records.has(name));records.set(name,value);},
    runner:async()=>hit('runner'),original:async()=>{hit('original');return{manifest:{sourceRepository:input.repository}};},space:async()=>{hit('space');return 1000;},
    stage:async()=>{hit('stage');return{
      intent:async()=>hit('intent'),inspectStore:async()=>{hit('inspect');return present;},clone:async()=>hit('clone'),
      verify:async location=>hit('verify:'+location),syncStage:async()=>hit('syncStage'),checkpoint:async()=>hit('checkpoint'),
      publishExclusive:async()=>hit('renameExclusive'),syncParents:async()=>hit('syncParents')};}
  };
  return {calls,records,run:()=>migrateWithLocks(mod,input,'/owned-run',io)};
}
test('production adapter composes the existing procedure under preview then store lock', async()=>{
  const h=harness();await h.run();
  assert.deepEqual(h.calls,['load','preview:enter','fresh','record:migration-before.json','marker','runner','original','space','record:migration-intent.json','store','storelock:enter','stage','intent','inspect','clone','verify:stage','syncStage','checkpoint','renameExclusive','syncParents','verify:destination','fresh','record:migration-after.json','record:migration-result.json','storelock:exit','preview:exit']);
  assert.equal(h.records.get('migration-result.json').outcome,'migrated');
});
test('already-present exact artifact verifies and never clones or publishes again',async()=>{
 const h=harness({present:true});await h.run();assert.equal(h.records.get('migration-result.json').outcome,'already-present-exact');
 for(const name of ['clone','verify:stage','checkpoint','renameExclusive'])assert.ok(!h.calls.includes(name));
 assert.ok(h.calls.includes('verify:destination'));
});
test('clone failure retains unknown and releases both normal locks without publishing',async()=>{
 const h=harness({fail:'clone'});await assert.rejects(h.run(),{code:'PRIMARY'});assert.equal(h.records.get('migration-result.json').outcome,'unknown');
 assert.ok(!h.calls.includes('renameExclusive'));assert.deepEqual(h.calls.slice(-2),['storelock:exit','preview:exit']);
});
test('no-replace error is unknown; there is no retry, destination verify or deletion',async()=>{
 const h=harness({fail:'renameExclusive'});await assert.rejects(h.run(),{code:'PRIMARY'});
 assert.equal(h.calls.filter(x=>x==='renameExclusive').length,1);assert.ok(!h.calls.includes('verify:destination'));assert.equal(h.records.get('migration-result.json').retained,true);
});
test('changed private protection after publication cannot become migration success',async()=>{
 const h=harness({changedAfter:true});await assert.rejects(h.run());assert.equal(h.records.get('migration-result.json').outcome,'unknown');
 assert.ok(!h.records.has('migration-after.json'));
});
test('failed unknown-result persistence remains secondary to the original failure',async()=>{
 const h=harness({fail:'clone',recordFailure:true});await assert.rejects(h.run(),e=>e.code==='PRIMARY'&&e.recordError.code==='ERECORD');
 assert.deepEqual(h.calls.slice(-2),['storelock:exit','preview:exit']);
});
test('fresh marker failure never opens the artifact store and normal lock releases',async()=>{
 const h=harness({fail:'marker'});await assert.rejects(h.run(),{code:'PRIMARY'});assert.ok(!h.calls.includes('store'));assert.equal(h.calls.at(-1),'preview:exit');
});

test('actual runner port qualifies flow.runners, bounds one pool and preserves closure on each outcome', async()=>{
  const expected={id:'runner',maintenance_state:'accepting',maintenance_version:18,maintenance_operation_id:null};
  for(const mode of ['success','mismatch','query-error','query-and-close-error']) {
    const calls=[];let options;
    class Pool {
      constructor(value){options=value;}
      async query(sql,values){calls.push('query');assert.equal(sql,'SELECT id,maintenance_state,maintenance_version,maintenance_operation_id FROM flow.runners WHERE id=$1');assert.deepEqual(values,['runner']);if(mode.startsWith('query'))throw Object.assign(new Error('not public'),{code:'PRIMARY'});return{rows:[mode==='mismatch'?{...expected,maintenance_version:19}:expected]};}
      async end(){calls.push('end');if(mode==='query-and-close-error')throw Object.assign(new Error('not public either'),{code:'ECLOSE'});}
    }
    const work=confirmMigrationRunner(Pool,{databaseUrl:'fixture-only',runner:{runnerId:'runner'}},expected);
    if(mode==='success')await work;
    else if(mode==='mismatch')await assert.rejects(work,{code:'ERR_ASSERTION'});
    else await assert.rejects(work,error=>error.code==='PRIMARY'&&(mode!=='query-and-close-error'||error.recordError.code==='ECLOSE'));
    assert.equal(options.max,1);assert.equal(options.connectionTimeoutMillis,1500);assert.equal(options.statement_timeout,1500);assert.equal(options.query_timeout,2000);assert.deepEqual(calls,['query','end']);
  }
});
