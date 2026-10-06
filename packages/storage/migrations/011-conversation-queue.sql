ALTER TABLE flow.conversations ADD COLUMN queue_paused boolean NOT NULL DEFAULT false;
ALTER TABLE flow.conversations ADD COLUMN queue_revision integer NOT NULL DEFAULT 0 CHECK(queue_revision>=0);
ALTER TABLE flow.conversations ADD COLUMN queue_checked_at timestamptz NOT NULL DEFAULT '-infinity';
CREATE TABLE flow.conversation_queue (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES flow.conversations(id),
  sequence integer NOT NULL CHECK(sequence>0),
  state text NOT NULL DEFAULT 'waiting' CHECK(state IN ('waiting','cancelled','promoted')),
  user_text text NOT NULL CHECK(octet_length(user_text) BETWEEN 1 AND 16000),
  turn_id text UNIQUE REFERENCES flow.conversation_turns(id),
  task_id text UNIQUE REFERENCES flow.tasks(id),
  turn_number integer,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(conversation_id,sequence),
  CHECK ((state='promoted' AND turn_id IS NOT NULL AND task_id IS NOT NULL AND turn_number IS NOT NULL AND turn_number>0)
    OR (state<>'promoted' AND turn_id IS NULL AND task_id IS NULL AND turn_number IS NULL))
);
CREATE INDEX conversation_queue_waiting ON flow.conversation_queue(conversation_id,sequence) WHERE state='waiting';
CREATE INDEX conversations_queue_scan ON flow.conversations(queue_checked_at,id);
