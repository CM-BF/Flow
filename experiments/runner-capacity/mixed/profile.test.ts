import { expect, test } from 'vitest';
import { Budget } from './contract.js';
import { selectRunIdentity } from './run-identity.js';
import { validGate, type CaseResult } from './proof.js';
import { observePg, type PgObservation } from './observe-pg.js';

const identity = () => selectRunIdentity('after-light-reads-128-v1');
test('the single approved128 profile binds main, one8x16 case and independent reservation', () => {
  const run = identity();
  expect(run).toMatchObject({ base: '1c4968354dabce1e6748f3301a2e6eecd33e77d4', output: 'docs/evidence/s01/mixed-128-run' });
  expect(run.contract).toMatchObject({ tasks: 128, maximumTasks: 128, totalMs: 180000, workMs: 150000,
    eventsPerSecond: 2, requestMs: 3000, settlementMs: 5000, cancelCount: 0,
    cases: [{ id: 'eight-by-sixteen', runners: 8, slots: 16 }] });
  expect(run.contract.cleanup.result).toBe(179500);
});
test('128 budget has no129th submission and preserves30seconds for cleanup', () => {
  const contract = identity().contract; let now = 0;
  const budget = new Budget(0, () => now, contract);
  for (let i = 0; i < 128; i++) budget.submit();
  expect(() => budget.submit()).toThrow('mixed_task_budget_exhausted');
  now = 150000; expect(() => budget.work()).toThrow('mixed_work_budget_exhausted');
  expect(budget.remainingTotalMs).toBe(30000);
});
test('the128 gate needs128 distinct persisted sessions and exact ownership, never repeated observations', () => {
  const contract = identity().contract;
  const rows = Array.from({ length: 128 }, (_, i) => ({ task_id: 'task-'+i, status: 'running', live: true, completed_at: null,
    attempt_id: 'attempt-'+i, current_attempt_id: 'attempt-'+i, owner_version: 1, task_version: 1, runner_id: 'runner-'+Math.floor(i/16),
    native_session_id: 'session-'+i, session_id: 'session-'+i, session_runner_id: 'runner-'+Math.floor(i/16), session_harness: 'fixture', session_task_id: 'task-'+i }));
  const result: CaseResult = { id: 'case', taskIds: rows.map(r=>r.task_id), cancelled: [], gate: [], windowComplete: false, settledByDeadline: false };
  const claims = rows.map(r=>({ kind: 'claim', pid: 1, receivedMs: 0, taskId: r.task_id, attemptId: r.attempt_id, ownerVersion: 1, runnerId: r.runner_id }));
  const ready=claims.map(x=>({...x,kind:'adapter-ready'}));
  const acks=claims.map((x,i)=>({...x,kind:'event-ack',events:[{type:'session',nativeSessionId:rows[i]!.native_session_id}]}));
  const beats=claims.map(x=>({...x,kind:'heartbeat',action:'continue'}));
  expect(validGate(result,rows,claims,ready,acks,beats,contract)).toBe(true);
  rows[0]!.session_id=rows[1]!.session_id; expect(validGate(result,rows,claims,ready,acks,beats,contract)).toBe(false);
  rows[0]!.session_id='session-0'; rows[0]!.live=false; expect(validGate(result,rows,claims,ready,acks,beats,contract)).toBe(false);
});
test('private SQL observation distinguishes the new SHARE fence without changing returned promises', async () => {
  const records: PgObservation[]=[]; const result=Promise.resolve({rows:[]});
  const client={query:(_sql: string)=>result}; const proto={connect:()=>Promise.resolve(client)};
  const observe=observePg(proto,x=>records.push(x));
  try { await proto.connect(); expect(client.query('SELECT * FROM flow.runners WHERE id=$1 FOR SHARE')).toBe(result); await result;
    expect(records.some(x=>x.category==='runner-row-share')).toBe(true);
  } finally { observe.restore(); }
});
