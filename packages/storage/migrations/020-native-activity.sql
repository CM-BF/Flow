CREATE TABLE flow.native_activities (
  ordinal bigserial UNIQUE NOT NULL,
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  event_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  native_session_id text NOT NULL,
  tool_use_id text,
  parent_tool_use_id text,
  phase text NOT NULL,
  header jsonb NOT NULL,
  payload_digest text NOT NULL,
  detail_id text UNIQUE NOT NULL REFERENCES flow.details(id),
  detail_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX native_activities_task ON flow.native_activities(task_id, ordinal);
CREATE UNIQUE INDEX native_activities_source ON flow.native_activities(native_session_id, (header->>'sourceMessageId'), ((header->>'blockIndex')::integer));
CREATE INDEX native_activities_tool ON flow.native_activities(attempt_id, tool_use_id, ordinal DESC) WHERE tool_use_id IS NOT NULL;
