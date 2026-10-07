import { RUNNER_CLAIM_PROTOCOL, runnerClaimRequestSchema, type RunnerIdentity, type RunnerClaimRequest, type RunnerClaimReceipt, type RunnerClaimResponse } from '../../../packages/contracts/src/runner-claim.js';
import { goalExecutionInputForTask } from './goal-context/index.js';
import { executionInputForTask } from './conversation-context/store.js';
import { assertTaskExecutionProfile } from './execution-profiles/store.js';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { type ClaimedTask, type AttemptView, type ClaimResponse, type Ownership, type RegisterRunner, type RunnerRegistration, type HeartbeatResponse, type DecisionAnswer } from '@flow/contracts';
import { pluginRunnerClaimRequestSchema, pluginRunnerClaimResponseSchema, type PluginRunnerClaimRequest, type PluginRunnerClaimResponse, type PluginToolExecution } from '../../../packages/contracts/src/plugin-runner-claim.js';
import type { PluginToolBinding } from '../../../packages/contracts/src/plugin-runtime.js';
import { claimPluginBinding, pluginClaimEligibilitySql } from './plugin-runtime/claim.js';
import { readClaimReceipt, saveClaimReceipt } from './runner-claim-receipts.js';
import { HttpError, sha256, transaction } from './database.js';
import { loadTask, type TaskRecord } from './tasks.js';

export interface RunnerRecord { id: string; harnesses: string[]; capacity: number; revoked: boolean; maintenance_state?: 'accepting' | 'draining' | 'maintenance' }
export interface AttemptRecord {
  id: string; task_id: string; runner_id: string; owner_version: number; lease_expires_at: Date;
  last_heartbeat_at: Date | null; last_event_at: Date | null;
  last_sequence: number; native_session_id: string | null; completed_at: Date | null;
}
export function attemptView(attempt: AttemptRecord): AttemptView {
  return { id: attempt.id, runnerId: attempt.runner_id, ownerVersion: attempt.owner_version, leaseExpiresAt: attempt.lease_expires_at.toISOString(),
    ...(attempt.native_session_id ? { nativeSessionId: attempt.native_session_id } : {}) };
}
export async function lockRunner(client: PoolClient, id: string): Promise<RunnerRecord> {
  const result = await client.query<RunnerRecord>('SELECT * FROM flow.runners WHERE id=$1 FOR UPDATE', [id]);
  const runner = result.rows[0];
  if (!runner || runner.revoked) throw new HttpError(401, 'runner_revoked', 'Runner credential is unavailable.');
  return runner;
}
/** Existing-attempt reads share this fence; these paths must not upgrade the runner lock or insert attempts. */
async function lockRunnerForAttempt(client: PoolClient, id: string): Promise<void> {
  const result = await client.query<Pick<RunnerRecord, 'id' | 'revoked'>>('SELECT id,revoked FROM flow.runners WHERE id=$1 FOR SHARE', [id]);
  const runner = result.rows[0];
  if (!runner || runner.revoked) throw new HttpError(401, 'runner_revoked', 'Runner credential is unavailable.');
}
export async function ownedAttempt(client: PoolClient, runnerId: string, ownership: Ownership) {
  await lockRunnerForAttempt(client, runnerId);
  const result = await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1', [ownership.attemptId]);
  const found = result.rows[0];
  if (!found || found.runner_id !== runnerId) throw new HttpError(403, 'attempt_forbidden', 'This attempt belongs to another runner.');
  const task = await loadTask(client, found.task_id, true);
  const attempt = (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1 FOR UPDATE', [found.id])).rows[0]!;
  if (attempt.owner_version !== ownership.ownerVersion || task.current_attempt_id !== attempt.id || task.owner_version !== ownership.ownerVersion) throw new HttpError(409, 'stale_owner', 'Attempt ownership changed.');
  return { attempt, task };
}
export async function registerRunner(pool: Pool, input: RegisterRunner): Promise<RunnerRegistration> {
  const runnerId = randomUUID();
  const token = randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,$2,$3,$4,$5)', [runnerId, input.name, sha256(token), input.harnesses, input.capacity ?? 1]);
  return { runnerId, token };
}
export async function claim(pool: Pool, runnerId: string, leaseMs: number): Promise<ClaimResponse> {
  return transaction(pool, async client => allocateClaim(client, await lockRunner(client, runnerId), leaseMs));
}

/** Both protocols enter with the same exclusive runner lock and transaction. */
async function allocateClaim(client: PoolClient, runner: RunnerRecord, leaseMs: number, qualification?: PluginToolExecution): Promise<ClaimResponse> {
  const runnerId = runner.id;
  if (runner.maintenance_state && runner.maintenance_state !== 'accepting') return { assignment: null, remainingLeaseMs: 0 };
  const busy = await client.query<{ count: number }>("SELECT count(*)::integer AS count FROM flow.attempts WHERE runner_id=$1 AND completed_at IS NULL", [runnerId]);
  if (busy.rows[0]!.count >= runner.capacity) return { assignment: null, remainingLeaseMs: 0 };
  const result = await client.query<{ id: string }>(`
    SELECT t.id FROM flow.tasks t LEFT JOIN flow.execution_profiles rp ON rp.runner_id=$2 LEFT JOIN flow.sessions s ON s.id=t.submission->>'resumeSessionId' AND s.harness=t.submission->>'harness'
    WHERE t.status='queued' AND t.dispatch_ready AND t.submission->>'harness'=ANY($1)
    AND (t.submission->'executionProfile' IS NULL OR t.submission->'executionProfile'->>'runnerId'=$2)
    -- Configured Claude settings runners must skip legacy work before LIMIT; full tuple validation remains below.
    AND (t.submission->>'harness'<>'claude' OR NOT COALESCE(rp.configuration ? 'turnSettings',false) OR
      (t.submission->'executionProfile'=jsonb_build_object('id',rp.id,'runnerId',$2::text,'configDigest',rp.config_digest)
        AND t.submission->'messageSettings'->>'protocol'='flow.claude-turn-settings.v1'
        AND t.submission->'messageSettings'->'profile'=t.submission->'executionProfile'))
    AND ((t.submission->'engineering' IS NULL AND COALESCE(rp.configuration->>'purpose','') NOT IN ('engineering-fixture','engineering-native')) OR
      (t.submission->'engineering'->>'targetRunnerId'=$2
        AND ((t.submission->'engineering'->>'protocol'='flow.engineering.v1' AND rp.configuration->>'protocol'='flow.engineering-profile.v1'
          AND rp.configuration->>'purpose'='engineering-fixture' AND rp.configuration->>'harness'='fixture' AND t.submission->>'harness'='fixture')
        OR (t.submission->'engineering'->>'protocol'='flow.engineering.v2' AND rp.configuration->>'protocol'='flow.engineering-profile.v2'
          AND rp.configuration->>'purpose'='engineering-native' AND rp.configuration->>'harness'='codex' AND t.submission->>'harness'='codex'
          AND rp.configuration->>'adapterVersion'='engineering-codex-1'))
        AND t.submission->'engineering'->'profile'->>'id'=rp.id
        AND t.submission->'engineering'->'profile'->>'runnerId'=$2
        AND t.submission->'engineering'->'profile'->>'configDigest'=rp.config_digest
        AND t.submission->'engineering'->>'projectId'=rp.configuration->'project'->>'id'
        AND t.submission->'engineering'->>'baseCommit'=rp.configuration->'project'->>'baseCommit'
        AND t.submission->'engineering'->'checker'=rp.configuration->'checker'))
    AND (COALESCE(rp.configuration->>'access','none')<>'goal-tools' OR
      (t.submission->'executionProfile'->>'runnerId'=$2 AND EXISTS
        (SELECT 1 FROM flow.goal_tool_runs g WHERE g.task_id=t.id AND g.mode='claude' AND g.revoked_at IS NULL)))
    AND (COALESCE(rp.configuration->>'access','none')<>'goal-graph-tools' OR
      (t.submission->'executionProfile'->>'runnerId'=$2 AND EXISTS
        (SELECT 1 FROM flow.goal_graph_runs g WHERE g.task_id=t.id AND g.mode='claude' AND g.revoked_at IS NULL)))
    AND (t.submission->>'resumeSessionId' IS NULL OR (s.runner_id=$2 AND s.active_task_id IS NULL))
    ${pluginClaimEligibilitySql}
    ORDER BY t.created_at,t.id FOR UPDATE OF t SKIP LOCKED LIMIT 1`, [runner.harnesses, runnerId, qualification?.storeId ?? null, qualification?.hostApiMajor ?? null]);
  if (!result.rows[0]) return { assignment: null, remainingLeaseMs: 0 };
  const task = await loadTask(client, result.rows[0].id);
  if (task.submission.engineering && (task.submission.harness !== (task.submission.engineering.protocol === 'flow.engineering.v1' ? 'fixture' : 'codex') || task.submission.engineering.targetRunnerId !== runnerId)) {
    throw new HttpError(409, 'engineering_runner_mismatch', 'The engineering intent does not belong to this purpose runner.');
  }
  const goalRun = (await client.query<{ id: string; version: 1; mode: string }>('SELECT id,version,mode FROM flow.goal_tool_runs WHERE task_id=$1', [task.id])).rows[0];
  const graphRun = (await client.query<{ id: string; version: 1; mode: string }>('SELECT id,version,mode FROM flow.goal_graph_runs WHERE task_id=$1', [task.id])).rows[0];
  if (goalRun && graphRun) throw new HttpError(409, 'planner_authority_conflict', 'A planner task cannot have two tool authorities.');
  await assertTaskExecutionProfile(client, task.submission, graphRun?.mode === 'claude' ? 'goal-graph-tools' : goalRun?.mode === 'claude' ? 'goal-tools' : 'ordinary');
  if (task.submission.resumeSessionId) {
    const session = await client.query('UPDATE flow.sessions SET active_task_id=$3 WHERE id=$1 AND harness=$2 AND runner_id=$4 AND active_task_id IS NULL RETURNING id', [task.submission.resumeSessionId, task.submission.harness, task.id, runnerId]);
    if (!session.rowCount) return { assignment: null, remainingLeaseMs: 0 };
  }
  const binding = await claimPluginBinding(client, task, runnerId, qualification);
  const id = randomUUID();
  const inserted = await client.query<AttemptRecord>("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+$5 * interval '1 millisecond') RETURNING *", [id, task.id, runnerId, task.owner_version + 1, leaseMs]);
  await client.query("UPDATE flow.tasks SET status='running',current_attempt_id=$2,owner_version=owner_version+1,updated_at=clock_timestamp() WHERE id=$1", [task.id, id]);
  return { assignment: await assignmentForTask(client, task, inserted.rows[0]!, goalRun, graphRun, binding), remainingLeaseMs: leaseMs };
}

type ToolRun = { id: string; version: 1; mode: string };
async function assignmentForTask(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, goalRun?: ToolRun, graphRun?: ToolRun, binding?: PluginToolBinding): Promise<ClaimedTask> {
  const executionInput = await executionInputForTask(client, task.id, task.submission.prompt);
  const goalInput = await goalExecutionInputForTask(client, task.id, task.submission.prompt);
  const privatePrompt = goalInput?.prompt ?? executionInput?.prompt;
  return { ...(binding ? { pluginToolBinding: binding } : {}), ...(executionInput ? { conversationContext: executionInput.context } : {}), attempt: attemptView(attempt),
    task: { ...task.submission, id: task.id, ...(privatePrompt !== undefined ? { prompt: privatePrompt } : {}) },
    ...(goalRun?.mode === 'claude' ? { goalToolRun: { id: goalRun.id, version: goalRun.version } } : {}),
    ...(graphRun?.mode === 'claude' ? { goalGraphRun: { id: graphRun.id, version: graphRun.version } } : {}) };
}

export async function runnerIdentity(pool: Pool, runnerId: string): Promise<RunnerIdentity> {
  return transaction(pool, async client => { await lockRunner(client, runnerId); return { protocol: RUNNER_CLAIM_PROTOCOL, runnerId }; });
}

type OpportunityRequest = RunnerClaimRequest | PluginRunnerClaimRequest;
type OpportunityResponse = RunnerClaimResponse | PluginRunnerClaimResponse;
export function claimOpportunity(pool: Pool, runnerId: string, input: RunnerClaimRequest, leaseMs: number): Promise<RunnerClaimResponse>;
export function claimOpportunity(pool: Pool, runnerId: string, input: PluginRunnerClaimRequest, leaseMs: number): Promise<PluginRunnerClaimResponse>;
export function claimOpportunity(pool: Pool, runnerId: string, input: OpportunityRequest, leaseMs: number): Promise<OpportunityResponse>;
export async function claimOpportunity(pool: Pool, runnerId: string, input: OpportunityRequest, leaseMs: number): Promise<OpportunityResponse> {
  const request = parseClaimRunner(input, runnerId); // Detach before the asynchronous runner lock.
  return transaction(pool, async client => {
    const runner = await lockRunner(client, runnerId);
    const previous = await readClaimReceipt(client, request);
    if (previous) return readCurrentAssignment(client, request, previous);
    const qualification = request.protocol === 'flow.runner-claim.v3' ? request.pluginToolExecution : undefined;
    const allocated = await allocateClaim(client, runner, leaseMs, qualification);
    if (!allocated.assignment) return { ...request, state: 'empty' };
    const { task, attempt } = allocated.assignment;
    const identity = { taskId: task.id, attemptId: attempt.id, runnerId, ownerVersion: attempt.ownerVersion };
    await saveClaimReceipt(client, request, identity);
    return readCurrentAssignment(client, request, identity);
  });
}

/** Business read only; ordinary transaction permits the locks required for consistent current fencing. */
export function claimOpportunityStatus(pool: Pool, runnerId: string, input: RunnerClaimRequest): Promise<RunnerClaimResponse>;
export function claimOpportunityStatus(pool: Pool, runnerId: string, input: PluginRunnerClaimRequest): Promise<PluginRunnerClaimResponse>;
export function claimOpportunityStatus(pool: Pool, runnerId: string, input: OpportunityRequest): Promise<OpportunityResponse>;
export async function claimOpportunityStatus(pool: Pool, runnerId: string, input: OpportunityRequest): Promise<OpportunityResponse> {
  const request = parseClaimRunner(input, runnerId);
  return transaction(pool, async client => {
    await lockRunner(client, runnerId);
    const identity = await readClaimReceipt(client, request);
    return identity ? readCurrentAssignment(client, request, identity) : { ...request, state: 'missing' };
  });
}

function parseClaimRunner(input: OpportunityRequest, runnerId: string): OpportunityRequest {
  const parsed = runnerClaimRequestSchema.or(pluginRunnerClaimRequestSchema).safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'invalid_claim_opportunity', 'Invalid claim opportunity.');
  if (parsed.data.runnerId !== runnerId) throw new HttpError(403, 'claim_runner_mismatch', 'The opportunity belongs to another runner identity.');
  return parsed.data;
}

async function readCurrentAssignment(client: PoolClient, input: OpportunityRequest, identity: RunnerClaimReceipt): Promise<OpportunityResponse> {
  const unavailable = { ...input, state: 'unavailable' as const, identity, reason: 'not-executable' as const };
  // The caller already holds runner; preserve runner -> task -> attempt even for historical receipts.
  const task = (await client.query<TaskRecord>('SELECT * FROM flow.tasks WHERE id=$1 FOR UPDATE', [identity.taskId])).rows[0];
  if (!task) return unavailable;
  const attempt = (await client.query<AttemptRecord>('SELECT * FROM flow.attempts WHERE id=$1 FOR UPDATE', [identity.attemptId])).rows[0];
  if (!attempt || attempt.runner_id !== input.runnerId || attempt.task_id !== identity.taskId
    || attempt.owner_version !== identity.ownerVersion || task.owner_version !== identity.ownerVersion
    || task.current_attempt_id !== identity.attemptId || attempt.completed_at
    || !['running', 'waiting', 'cancel_requested'].includes(task.status)) return unavailable;
  const goalRun = (await client.query<ToolRun>('SELECT id,version,mode FROM flow.goal_tool_runs WHERE task_id=$1', [task.id])).rows[0];
  const graphRun = (await client.query<ToolRun>('SELECT id,version,mode FROM flow.goal_graph_runs WHERE task_id=$1', [task.id])).rows[0];
  if (goalRun && graphRun) return unavailable;
  await assertTaskExecutionProfile(client, task.submission, graphRun?.mode === 'claude' ? 'goal-graph-tools' : goalRun?.mode === 'claude' ? 'goal-tools' : 'ordinary');
  if (task.submission.resumeSessionId && !(await client.query(
    'SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2 AND runner_id=$3 AND active_task_id=$4',
    [task.submission.resumeSessionId, task.submission.harness, input.runnerId, task.id])).rowCount) return unavailable;
  let binding: PluginToolBinding | undefined;
  try { binding = await claimPluginBinding(client, task, input.runnerId, input.protocol === 'flow.runner-claim.v3' ? input.pluginToolExecution : undefined); }
  catch (error) { if (error instanceof HttpError && error.code === 'plugin_claim_unavailable') return unavailable; throw error; }
  const assignment = await assignmentForTask(client, task, attempt, goalRun, graphRun, binding);
  const remainingLeaseMs = (await client.query<{ remaining_ms: number }>(
    'SELECT floor(EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp()))*1000)::double precision AS remaining_ms', [attempt.lease_expires_at])).rows[0]!.remaining_ms;
  if (!Number.isSafeInteger(remainingLeaseMs) || remainingLeaseMs <= 0 || remainingLeaseMs > 300000) return unavailable;
  const response = { ...input, state: 'assigned' as const, identity, assignment, remainingLeaseMs };
  return input.protocol === 'flow.runner-claim.v3' ? pluginRunnerClaimResponseSchema.parse(response) : response;
}
export async function heartbeat(pool: Pool, runnerId: string, ownership: Ownership, leaseMs: number): Promise<HeartbeatResponse> {
  return transaction(pool, async client => {
    const { attempt, task } = await ownedAttempt(client, runnerId, ownership);
    const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    if (!live || attempt.completed_at || task.status === 'uncertain') {
      if (!attempt.completed_at) await client.query("UPDATE flow.tasks SET status='uncertain',updated_at=clock_timestamp() WHERE id=$1 AND status<>'uncertain'", [task.id]);
      return { action: 'stop', leaseExpiresAt: attempt.lease_expires_at.toISOString(), remainingLeaseMs: 0, decision: null };
    }
    const updated = await client.query<AttemptRecord>("UPDATE flow.attempts SET last_heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+$2 * interval '1 millisecond' WHERE id=$1 RETURNING *", [attempt.id, leaseMs]);
    const answer = task.pending_decision ? undefined : (await client.query<{ id: string; answer: DecisionAnswer['answer'] }>('SELECT id,answer FROM flow.decisions WHERE task_id=$1 AND answer IS NOT NULL ORDER BY answered_at DESC LIMIT 1', [task.id])).rows[0];
    return { action: task.status === 'cancel_requested' ? 'cancel' : 'continue', leaseExpiresAt: updated.rows[0]!.lease_expires_at.toISOString(), remainingLeaseMs: leaseMs, decision: answer ? { decisionId: answer.id, answer: answer.answer } : null };
  });
}
export async function revoke(pool: Pool, runnerId: string): Promise<{ revoked: true }> {
  return transaction(pool, async client => {
    const runner = await client.query('SELECT id FROM flow.runners WHERE id=$1 FOR UPDATE', [runnerId]);
    if (!runner.rowCount) throw new HttpError(404, 'runner_not_found', 'Runner not found.');
    await client.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [runnerId]);
    await client.query("UPDATE flow.tasks t SET status='uncertain',updated_at=clock_timestamp() FROM flow.attempts a WHERE t.current_attempt_id=a.id AND a.runner_id=$1 AND a.completed_at IS NULL AND t.status IN ('running','waiting','cancel_requested')", [runnerId]);
    return { revoked: true };
  });
}
export async function expireLeases(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    const tasks = await client.query<{ id: string; current_attempt_id: string }>(`SELECT t.id,t.current_attempt_id FROM flow.tasks t JOIN flow.attempts a ON t.current_attempt_id=a.id
      WHERE a.completed_at IS NULL AND a.lease_expires_at<=clock_timestamp() AND t.status IN ('running','waiting','cancel_requested')
      ORDER BY a.lease_expires_at LIMIT 100 FOR UPDATE OF t SKIP LOCKED`);
    for (const task of tasks.rows) {
      // Re-read after the task lock: a concurrent heartbeat may have renewed the lease.
      const expired = await client.query('SELECT id FROM flow.attempts WHERE id=$1 AND completed_at IS NULL AND lease_expires_at<=clock_timestamp() FOR UPDATE', [task.current_attempt_id]);
      if (expired.rowCount) await client.query("UPDATE flow.tasks SET status='uncertain',updated_at=clock_timestamp() WHERE id=$1", [task.id]);
    }
  });
}
