CREATE TABLE flow.assistant_messages (
  ordinal bigserial UNIQUE NOT NULL,
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text UNIQUE NOT NULL REFERENCES flow.attempts(id),
  event_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  native_session_id text NOT NULL,
  source text NOT NULL CHECK (source = 'claude.sdk.result'),
  source_message_id text NOT NULL,
  content_digest text NOT NULL,
  detail_id text UNIQUE NOT NULL REFERENCES flow.details(id),
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(native_session_id, source_message_id)
);
CREATE INDEX assistant_messages_task ON flow.assistant_messages(task_id, ordinal);
