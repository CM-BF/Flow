import { expect, test } from 'vitest';
import { ClaimFixture } from '../../../../docs/evidence/x01/center-claim-fixture.js';
import { claim, claimOpportunity, claimOpportunityStatus } from '../runners.js';
import { pluginClaimEligibilitySql } from './claim.js';

const v2 = (f: ClaimFixture) => ({ protocol: 'flow.runner-claim.v2' as const, runnerId: f.runnerId, requestId: f.request.requestId });
test('legacy and v2 apply qualification filtering before LIMIT, while v3 emits the exact frozen binding', async () => {
  const f = new ClaimFixture();
  expect((await claim(f.pool, f.runnerId, 5000)).assignment).toBeNull();
  expect((await claimOpportunity(f.pool, f.runnerId, v2(f), 5000)).state).toBe('empty');
  expect(f.receipts).toEqual([]);
  const allocation = await claimOpportunity(f.pool, f.runnerId, f.request, 5000);
  expect(allocation.state).toBe('assigned');
  if (allocation.state !== 'assigned') throw new Error('Expected allocation');
  expect(allocation.assignment.pluginToolBinding).toEqual(f.binding);
  const selections = f.queries.filter(x => x.sql.includes('SELECT t.id FROM flow.tasks t'));
  expect(selections).toHaveLength(3);
  for (const selection of selections) expect(selection.sql.indexOf(pluginClaimEligibilitySql)).toBeLessThan(selection.sql.indexOf('LIMIT 1'));
  expect(selections.map(x => x.values.slice(2))).toEqual([[null,null],[null,null],['owned-store',1]]);
  expect(f.queries.filter(x => x.sql.startsWith('INSERT INTO flow.attempts'))).toHaveLength(1);
});
test('ordinary tasks stay available to v2 and v3 without a binding field', async () => {
  for (const protocol of [2,3]) {
    const f = new ClaimFixture(); f.plugin = false;
    const value = await claimOpportunity(f.pool,f.runnerId,protocol===2?v2(f):f.request,5000);
    expect(value.state).toBe('assigned'); if(value.state==='assigned') expect(value.assignment).not.toHaveProperty('pluginToolBinding');
  }
});
test('current grant is rechecked under registration lock before allocation, including a change after SQL selection', async () => {
  const f = new ClaimFixture(); f.beforeRegistration = () => { f.grant = false; };
  await expect(claimOpportunity(f.pool,f.runnerId,f.request,5000)).rejects.toMatchObject({code:'plugin_claim_unavailable'});
  expect(f.attempt).toBeUndefined(); expect(f.receipts).toEqual([]);
  const sql = f.queries.map(x=>x.sql); expect(sql.at(-1)).toBe('ROLLBACK');
  expect(sql.indexOf('SELECT * FROM flow.plugin_installations WHERE id=$1 FOR UPDATE')).toBeGreaterThan(sql.findIndex(x=>x.includes('FOR UPDATE OF t')));
});
test('receipt replays never allocate or renew, disabled/newer revision preserves old pin while revoked tool permission does not', async () => {
  const f = new ClaimFixture(); const first = await claimOpportunity(f.pool,f.runnerId,f.request,5000);
  f.currentRevision=8; f.maintenance='draining'; f.busy=2;
  expect(await claimOpportunityStatus(f.pool,f.runnerId,f.request)).toEqual(first);
  expect(await claimOpportunity(f.pool,f.runnerId,f.request,5000)).toEqual(first);
  f.grant=false;
  expect((await claimOpportunityStatus(f.pool,f.runnerId,f.request)).state).toBe('unavailable');
  expect(f.queries.filter(x=>x.sql.startsWith('INSERT INTO flow.attempts'))).toHaveLength(1);
  expect(f.queries.some(x=>x.sql.includes('UPDATE flow.attempts'))).toBe(false);
});
test('cross-protocol or changed qualification reuses no allocated key; missing status writes nothing', async () => {
  const f = new ClaimFixture();
  expect((await claimOpportunityStatus(f.pool,f.runnerId,f.request)).state).toBe('missing');
  expect(f.attempt).toBeUndefined(); expect(f.receipts).toEqual([]);
  await claimOpportunity(f.pool,f.runnerId,f.request,5000);
  await expect(claimOpportunity(f.pool,f.runnerId,v2(f),5000)).rejects.toMatchObject({code:'claim_key_conflict'});
  await expect(claimOpportunityStatus(f.pool,f.runnerId,{...f.request,pluginToolExecution:{...f.request.pluginToolExecution,storeId:'other'}})).rejects.toMatchObject({code:'claim_key_conflict'});
  const old = new ClaimFixture(); old.plugin=false; await claimOpportunity(old.pool,old.runnerId,v2(old),5000);
  await expect(claimOpportunity(old.pool,old.runnerId,old.request,5000)).rejects.toMatchObject({code:'claim_key_conflict'});
});
test('expired, stale, completed and revoked ownership cannot recover an executable assignment', async () => {
  for(const change of ['expired','stale','completed','revoked']) {
    const f=new ClaimFixture(); await claimOpportunity(f.pool,f.runnerId,f.request,5000);
    if(change==='expired')f.remaining=0;
    if(change==='stale')f.task.owner_version++;
    if(change==='completed')f.attempt!.completed_at=new Date();
    if(change==='revoked') { f.revoked=true; await expect(claimOpportunityStatus(f.pool,f.runnerId,f.request)).rejects.toMatchObject({status:401}); }
    else expect((await claimOpportunityStatus(f.pool,f.runnerId,f.request)).state).toBe('unavailable');
    expect(f.queries.filter(x=>x.sql.startsWith('INSERT INTO flow.attempts'))).toHaveLength(1);
  }
});
test('full request is detached before checkout and duplicate or corrupt receipt evidence fails closed', async()=>{
  const f=new ClaimFixture(); const input=structuredClone(f.request); const pending=claimOpportunity(f.pool,f.runnerId,input,5000);
  input.pluginToolExecution.storeId='mutated'; input.requestId='changed';
  const result=await pending;expect(result).toMatchObject({...f.request,state:'assigned'});
  f.receipts.push({...f.receipts[0]!,operation:`flow.runner-claim.v2:${f.runnerId}`});
  await expect(claimOpportunityStatus(f.pool,f.runnerId,f.request)).rejects.toMatchObject({code:'claim_receipt_unknown'});
  f.receipts.pop();f.receipts[0]!.response={runnerId:f.runnerId};
  await expect(claimOpportunityStatus(f.pool,f.runnerId,f.request)).rejects.toMatchObject({code:'claim_receipt_unknown'});
});
test('wrong host or revoked grant never reaches allocation, and capacity or maintenance blocks new opportunities',async()=>{
  for(const blocked of ['store','grant','host','capacity','maintenance']) {
    const f=new ClaimFixture();const request=structuredClone(f.request);
    if(blocked==='store')request.pluginToolExecution.storeId='other';
    if(blocked==='grant')f.grant=false;
    if(blocked==='host')f.host=false;
    if(blocked==='capacity')f.busy=2;
    if(blocked==='maintenance')f.maintenance='maintenance';
    expect((await claimOpportunity(f.pool,f.runnerId,request,5000)).state).toBe('empty');
    expect(f.receipts).toEqual([]);expect(f.attempt).toBeUndefined();
  }
});
