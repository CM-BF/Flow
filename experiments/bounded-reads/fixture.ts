import type { Pool } from 'pg';

export const DETAIL_MARKER = 'B01_PRIVATE_DETAIL_仅按需展开';
export const DETAIL_TEXT = DETAIL_MARKER + '细'.repeat(4096);
export const PROMPT_TEXT = 'B01_TASK_PROMPT_' + '问'.repeat(4096);
export const MESSAGE_TEXT = 'B01正文' + '文'.repeat(96);

/** Bulk fixture setup bypasses the write API; reads use the unmodified center HTTP. */
export async function seedHistory(pool: Pool, tasks: number, eventsPerTask: number) {
  await pool.query(`INSERT INTO flow.tasks(id,submission,status,cursor)
    SELECT 'b01-task-'||i,jsonb_build_object('title','B01 合成任务 '||i,'prompt',$2::text,'harness','fixture'),'succeeded',$3
    FROM generate_series(1,$1::integer) i`, [tasks, PROMPT_TEXT, eventsPerTask]);
  await pool.query(`INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity)
    VALUES('b01-seed','Synthetic completed history','unused',ARRAY['fixture'],1)`);
  await pool.query(`INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at)
    SELECT 'b01-attempt-'||i,'b01-task-'||i,'b01-seed',1,clock_timestamp(),clock_timestamp()
    FROM generate_series(1,$1::integer) i`, [tasks]);
  await pool.query(`INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type)
    SELECT 'b01-detail-'||i,'b01-task-'||i,'b01-attempt-'||i,'折叠引用','detail',$2,'text/plain'
    FROM generate_series(1,$1::integer) i`, [tasks, DETAIL_TEXT]);
  await pool.query(`INSERT INTO flow.timeline(task_id,cursor,entry)
    SELECT 'b01-task-'||i,j,jsonb_build_object('id','b01-entry-'||i||'-'||j,'cursor',j,
      'createdAt','2026-10-06T00:00:00.000Z') || CASE WHEN j%8=0 THEN
      jsonb_build_object('kind','reference','reference',jsonb_build_object('id','b01-detail-'||i,'title','折叠引用'))
      ELSE jsonb_build_object('kind','text','text',$3::text) END
    FROM generate_series(1,$1::integer) i CROSS JOIN generate_series(1,$2::integer) j`, [tasks, eventsPerTask, MESSAGE_TEXT]);
  await pool.query('ANALYZE flow.tasks; ANALYZE flow.timeline; ANALYZE flow.workspace_feed');
}
