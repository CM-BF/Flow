import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { ClaimError, normalizeCommand, sameActor, scopesOverlap, validateAmendedScope } from './input.mjs';

export function coordinationPool(connectionString = process.env.FLOW_COORDINATION_DATABASE_URL) {
  if (!connectionString) throw new ClaimError('UNAVAILABLE', '未配置协调 PostgreSQL，领取状态未知');
  return new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 800, statement_timeout: 1000, query_timeout: 1200, idleTimeoutMillis: 1000, application_name: 'flow-engineering-claims' });
}
export async function initializeLedger(pool) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS flow_engineering;
    CREATE TABLE IF NOT EXISTS flow_engineering.claims (id uuid PRIMARY KEY, value jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS flow_engineering.requests (request_id text PRIMARY KEY, payload jsonb NOT NULL, receipt jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS flow_engineering.audit (id bigserial PRIMARY KEY, request_id text UNIQUE NOT NULL, action text NOT NULL, previous jsonb, receipt jsonb NOT NULL);`);
}
function assertOwner(claim, command) {
  if (claim.version !== command.version) throw new ClaimError('STALE_VERSION', 'claim version 已改变；重新读取，禁止使用旧回执写入');
  const expected = command.action === 'accept' ? claim.next : claim;
  if (!expected || !sameActor(expected, command.actor)) throw new ClaimError('OWNER_MISMATCH', '命令不属于当前 owner/接收方');
}
function assertNoConflict(candidate, active) {
  if (candidate.role !== 'writer') return;
  const locations = claim => [claim.worktree, ...(claim.next ? [claim.next.worktree] : [])];
  for (const claim of active) {
    if (claim.claimId === candidate.claimId || claim.role !== 'writer') continue;
    if (claim.taskId === candidate.taskId || locations(candidate).some(place => locations(claim).includes(place)) || scopesOverlap(candidate.scope, claim.scope)) {
      throw new ClaimError('CONFLICT', `与 ${claim.taskId} 的 claim ${claim.claimId} 存在 task/worktree/scope 冲突`);
    }
  }
}
async function transition(previous, command) {
  if (!previous) throw new ClaimError('NOT_FOUND', 'claim 不存在');
  assertOwner(previous, command);
  if (previous.state === 'released') throw new ClaimError('RELEASED', 'claim 已释放，不得继续写入');
  const claim = { ...previous, version: previous.version + 1 };
  if (command.action === 'accept') {
    if (previous.state !== 'handoff_pending') throw new ClaimError('INVALID_STATE', '没有待接收的交接');
    return { ...claim, ...previous.next, next: null, state: 'active' };
  }
  if (previous.state !== 'active') throw new ClaimError('INVALID_STATE', '交接期间原 owner 已停止写入，只能由新 owner 接收');
  if (command.action === 'release') claim.state = 'released';
  if (command.action === 'amend') { await validateAmendedScope(previous, command.scope); claim.scope = command.scope;
    if (command.observedAt) {
      if (claim.origin !== 'migration') throw new ClaimError('INVALID', '只有 migration 原观察时间可以受审计纠正');
      claim.observedAt = command.observedAt;
    }
  }
  if (command.action === 'handoff') { claim.state = 'handoff_pending'; claim.next = command.next; }
  return claim;
}
export async function applyCommand(pool, raw, repository) {
  const command = await normalizeCommand(raw, repository);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // All allocation changes share this low-frequency engineering lock, never a product graph lock.
    await client.query('SELECT pg_advisory_xact_lock(1179406167, 4)');
    const replay = await client.query('SELECT receipt, payload = $2::jsonb AS matches FROM flow_engineering.requests WHERE request_id=$1', [command.requestId, JSON.stringify(command)]);
    if (replay.rowCount) {
      if (!replay.rows[0].matches) throw new ClaimError('REQUEST_CONFLICT', 'requestId 已用于不同 payload');
      await client.query('COMMIT');
      return replay.rows[0].receipt;
    }
    const values = (await client.query('SELECT value FROM flow_engineering.claims')).rows.map(row => row.value);
    const previous = command.action === 'take' ? null : values.find(claim => claim.claimId === command.claimId);
    let claim = command.action === 'take'
      ? { claimId: randomUUID(), version: 1, taskId: command.taskId, ...command.actor, worktree: command.worktree, branch: command.branch, scope: command.scope, role: command.role, state: 'active', next: null, origin: command.origin, observedAt: command.observedAt }
      : await transition(previous, command);
    if (claim.state !== 'released') assertNoConflict(claim, values.filter(value => value.state !== 'released'));
    const { rows } = await client.query('SELECT clock_timestamp() AS recorded_at');
    const timestamp = rows[0].recorded_at.toISOString();
    claim = { ...claim, updatedAt: timestamp, createdAt: claim.createdAt ?? timestamp };
    const receipt = { requestId: command.requestId, action: command.action, committedAt: timestamp, claim };
    await client.query('INSERT INTO flow_engineering.claims VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET value=excluded.value', [claim.claimId, JSON.stringify(claim)]);
    await client.query('INSERT INTO flow_engineering.requests VALUES ($1,$2,$3)', [command.requestId, JSON.stringify(command), JSON.stringify(receipt)]);
    await client.query('INSERT INTO flow_engineering.audit(request_id,action,previous,receipt) VALUES($1,$2,$3,$4)', [command.requestId, command.action, previous ? JSON.stringify(previous) : null, JSON.stringify(receipt)]);
    await client.query('COMMIT');
    return receipt;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Original outcome is retained; retry the same requestId if commit acknowledgement was lost. */ }
    throw error;
  } finally { client.release(); }
}
export async function readAssignments(pool, now = Date.now()) {
  const claims = (await pool.query('SELECT value FROM flow_engineering.claims ORDER BY value->>\'taskId\'')).rows.map(({ value }) => ({ ...value, needsVerification: now - Date.parse(value.updatedAt) > 24 * 3600000 }));
  return { state: 'available', observedAt: new Date(now).toISOString(), claims };
}
export async function assignmentSnapshot(connectionString = process.env.FLOW_COORDINATION_DATABASE_URL, now = Date.now()) {
  let pool;
  try { pool = coordinationPool(connectionString); return await readAssignments(pool, now); }
  catch { return { state: 'unknown', observedAt: new Date(now).toISOString(), claims: [], message: '领取状态未知：协调数据库未配置或暂不可用。禁止据此新 take。' }; }
  finally { if (pool) await pool.end(); }
}
