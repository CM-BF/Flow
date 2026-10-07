import type { PoolClient } from 'pg';
import { sha256 } from '../../../apps/server/src/database.js';
import { assistantMessageId } from '../../../apps/server/src/native-harness-policy.js';

export const mainConversation = 'req15-main', foreignConversation = 'req15-foreign', snapshotConversation = 'req15-snapshot';
const runner = '00000000-0000-4000-8000-000000000002', otherRunner = '00000000-0000-4000-8000-000000000003';
export const frozen = {
  protocol: 'flow.claude-turn-settings.v1',
  profile: { id: '00000000-0000-4000-8000-000000000001', runnerId: runner, configDigest: 'a'.repeat(64) },
  requested: { model: 'configured', thinking: 'adaptive', effort: { kind: 'not-requested' }, speed: 'fast' },
};
export const observed = { source: 'claude.sdk.system.init', model: 'actual', fastModeState: 'cooldown' };
const effective = { model: 'actual', thinking: 'unknown', permissionMode: 'dontAsk', tools: ['Read'] };
const legacySettings = { requested: { model: 'requested', thinking: 'disabled', permissionMode: 'dontAsk' }, effective };
const modes = ['typed', 'unicode', 'corrupt', 'legacy', 'ambiguous', 'duplicate-session', 'foreign-attempt',
  'wrong-owner', 'wrong-runner', 'wrong-harness', 'wrong-native', 'missing', 'pending', 'failed', 'unverified'] as const;
type Mode = typeof modes[number];
export const seeds = Array.from({ length: 53 }, (_, index) => {
  const mode: Mode = index === 50 ? 'corrupt' : index >= 51 ? 'typed' : modes[index % modes.length]!;
  const body = index === 0 ? 'a'.repeat(3999) + '🙂尾部✅' : mode === 'unicode' ? '汉'.repeat(4001) + 'e\u0301👩‍💻'
    : mode === 'corrupt' ? 'x'.repeat(4000) + 'ORIGINAL' : `reply-${index}`;
  const storedBody = mode === 'corrupt' ? 'x'.repeat(4000) + 'CORRUPTED' : body;
  const reason = ({ corrupt: 'invalid-result', ambiguous: 'ambiguous-result', 'duplicate-session': 'unknown-adapter',
    'foreign-attempt': 'missing-session', 'wrong-owner': 'missing-session', 'wrong-runner': 'missing-session',
    'wrong-harness': 'missing-session', 'wrong-native': 'invalid-result', missing: 'missing-result',
    pending: 'execution-pending', failed: 'execution-not-succeeded', unverified: 'invalid-result' } as Partial<Record<Mode, string>>)[mode];
  return { index, mode, taskId: `req15-task-${index}`, attemptId: `req15-attempt-${index}`, sessionId: `req15-session-${index}`,
    detailId: `req15-final-${index}`, body, storedBody, reason, expectedText: mode === 'legacy' ? `legacy-${index}` : body,
    conversation: index === 51 ? foreignConversation : index === 52 ? snapshotConversation : mainConversation,
    number: index >= 51 ? 1 : index + 1 };
});

/** Seed canonical tables in a single caller-owned transaction; this bypasses write admission intentionally. */
export async function seedReads(client: PoolClient, checkWork: () => void) {
  const tasks = [], attempts = [], sessions = [], details = [], messages = [], artifacts = [], turns = [];
  for (const item of seeds) {
    const { index, mode, taskId, attemptId, sessionId, detailId } = item;
    const legacy = ['legacy', 'ambiguous', 'corrupt'].includes(mode);
    const artifactBody = `legacy-${index}`, artifactId = `req15-artifact-${index}`;
    tasks.push({ id: taskId, submission: { title: `task-${index}`, prompt: 'frozen prompt', harness: 'claude',
      ...(index === 0 ? { messageSettings: frozen, executionProfile: frozen.profile } : {}) },
      status: mode === 'pending' ? 'running' : mode === 'failed' ? 'failed' : 'succeeded',
      verification_status: mode === 'unverified' ? 'failed' : 'passed', owner_version: mode === 'wrong-owner' ? 2 : 1,
      current_attempt_id: mode === 'foreign-attempt' ? seeds[0]!.attemptId : attemptId,
      latest_artifact_id: legacy ? artifactId : null, latest_artifact_version: legacy ? sha256(artifactBody) : null });
    attempts.push({ id: attemptId, task_id: taskId, native_session_id: sessionId, completed: mode !== 'pending' });
    sessions.push({ id: sessionId, harness: mode === 'wrong-harness' ? 'fixture-other' : 'claude', runner_id: mode === 'wrong-runner' ? otherRunner : runner });
    const sessionBody = JSON.stringify({ id: `session-event-${index}`, sequence: 1, type: 'session', nativeSessionId: sessionId,
      adapterVersion: legacy ? 'claude-sdk-0.3.290-v1' : 'claude-sdk-0.3.290-v2', resources: ['model:legacy-model'] });
    details.push({ id: `req15-session-detail-${index}`, task_id: taskId, attempt_id: attemptId, title: 'Session', kind: 'session', content: sessionBody, artifact_version: null });
    if (mode === 'duplicate-session') details.push({ ...details.at(-1)!, id: `req15-session-detail-${index}-second` });
    if (!['legacy', 'ambiguous', 'missing'].includes(mode)) {
      const native = mode === 'wrong-native' ? `req15-other-native-${index}` : sessionId;
      details.push({ id: detailId, task_id: taskId, attempt_id: attemptId, title: 'Assistant reply', kind: 'detail', content: item.body, artifact_version: null });
      messages.push({ id: assistantMessageId('claude.sdk.result', native, `source-${index}`), task_id: taskId, attempt_id: attemptId,
        native_session_id: native, source_message_id: `source-${index}`, content_digest: sha256(item.body), detail_id: detailId,
        settings: index === 0 ? { effective, messageSettings: { snapshot: frozen, observed } } : legacySettings });
    }
    if (legacy) for (let ordinal = 0; ordinal < (mode === 'ambiguous' ? 2 : 1); ordinal++) {
      const content = ordinal ? `${artifactBody}-second` : artifactBody, id = `${artifactId}-${ordinal}`;
      const version = sha256(content), selectedId = ordinal ? `${artifactId}-second` : artifactId;
      details.push({ id, task_id: taskId, attempt_id: attemptId, title: 'Result', kind: 'artifact', content, artifact_version: version });
      artifacts.push({ task_id: taskId, artifact_id: selectedId, version, attempt_id: attemptId, detail_id: id });
    }
    turns.push({ id: `req15-turn-${index}`, conversation_id: item.conversation, number: item.number, task_id: taskId, user_text: `question-${index}` });
  }
  const corruptions = seeds.filter(item => item.mode === 'corrupt').map(item => ({ id: item.detailId, content: item.storedBody }));
  const bodyBytes = [...details, ...corruptions].reduce((total, detail) => total + Buffer.byteLength(detail.content, 'utf8'), 0);
  if (tasks.length > 60 || attempts.length > 60 || sessions.length > 62 || details.length > 120 || messages.length > 60 || artifacts.length > 20
    || bodyBytes > 4194304 || [...details, ...corruptions].some(detail => Buffer.byteLength(detail.content, 'utf8') > 65536)) throw new Error('Seed exceeds approved bounds');
  checkWork();
  await client.query(`INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES
    ($1,'fixture subject','req15-token-a',ARRAY['claude'],1),($2,'fixture alternate','req15-token-b',ARRAY['claude'],1)`, [runner, otherRunner]);
  checkWork();
  await client.query(`INSERT INTO flow.conversations(id,title,harness,requested)
    SELECT id,'Fixture conversation','claude','{"model":"requested","thinking":"disabled","tools":"none"}'::jsonb FROM unnest($1::text[]) id`,
  [[mainConversation, foreignConversation, snapshotConversation]]);
  checkWork();
  await client.query(`INSERT INTO flow.tasks(id,submission,status,verification_status,owner_version,current_attempt_id,latest_artifact_id,latest_artifact_version)
    SELECT id,submission,status,verification_status,owner_version,current_attempt_id,latest_artifact_id,latest_artifact_version
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,submission jsonb,status text,verification_status text,owner_version integer,current_attempt_id text,latest_artifact_id text,latest_artifact_version text)`, [JSON.stringify(tasks)]);
  checkWork();
  await client.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,native_session_id,completed_at)
    SELECT id,task_id,$2,1,clock_timestamp()+interval '1 minute',native_session_id,CASE WHEN completed THEN clock_timestamp() END
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,task_id text,native_session_id text,completed boolean)`, [JSON.stringify(attempts), runner]);
  checkWork();
  await client.query(`INSERT INTO flow.sessions(id,harness,runner_id)
    SELECT id,harness,runner_id FROM jsonb_to_recordset($1::jsonb) AS x(id text,harness text,runner_id text)`, [JSON.stringify(sessions)]);
  checkWork();
  await client.query(`INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type,artifact_version)
    SELECT id,task_id,attempt_id,title,kind,content,'text/plain',artifact_version
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,task_id text,attempt_id text,title text,kind text,content text,artifact_version text)`, [JSON.stringify(details)]);
  checkWork();
  await client.query(`INSERT INTO flow.assistant_messages(id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings)
    SELECT id,task_id,attempt_id,'final-'||task_id,2,native_session_id,'claude.sdk.result',source_message_id,content_digest,detail_id,settings
    FROM jsonb_to_recordset($1::jsonb) AS x(id text,task_id text,attempt_id text,native_session_id text,source_message_id text,content_digest text,detail_id text,settings jsonb)`, [JSON.stringify(messages)]);
  checkWork();
  // Corrupt only the suffix after the valid full-body digest has been stored.
  await client.query(`UPDATE flow.details d SET content=x.content FROM jsonb_to_recordset($1::jsonb) AS x(id text,content text)
    WHERE d.id=x.id`, [JSON.stringify(corruptions)]);
  checkWork();
  await client.query(`INSERT INTO flow.artifacts(task_id,artifact_id,version,attempt_id,detail_id)
    SELECT task_id,artifact_id,version,attempt_id,detail_id FROM jsonb_to_recordset($1::jsonb) AS x(task_id text,artifact_id text,version text,attempt_id text,detail_id text)`, [JSON.stringify(artifacts)]);
  checkWork();
  await client.query(`INSERT INTO flow.conversation_turns(id,conversation_id,number,task_id,user_text)
    SELECT id,conversation_id,number,task_id,user_text FROM jsonb_to_recordset($1::jsonb) AS x(id text,conversation_id text,number integer,task_id text,user_text text)`, [JSON.stringify(turns)]);
  return { tasks: tasks.length, attempts: attempts.length, sessions: sessions.length, details: details.length,
    messages: messages.length, artifacts: artifacts.length, corruptSuffixUpdates: corruptions.length, seedAndUpdateBodyUtf8Bytes: bodyBytes };
}
