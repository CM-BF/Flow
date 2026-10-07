CREATE TABLE flow.assistant_stream_blocks (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  first_sequence integer NOT NULL,
  last_sequence integer NOT NULL,
  revision integer NOT NULL,
  bytes integer NOT NULL CHECK(bytes BETWEEN 0 AND 1048576),
  header jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX assistant_stream_task ON flow.assistant_stream_blocks(task_id,attempt_id,first_sequence);
CREATE TABLE flow.assistant_stream_patches (
  stream_id text NOT NULL REFERENCES flow.assistant_stream_blocks(id),
  revision integer NOT NULL,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  event_id text NOT NULL,
  sequence integer NOT NULL,
  data jsonb NOT NULL,
  payload_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(stream_id,revision),
  UNIQUE(attempt_id,sequence)
);
CREATE INDEX assistant_stream_patches_task ON flow.assistant_stream_patches(task_id,attempt_id,sequence);
CREATE TABLE flow.assistant_stream_markers (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  sequence integer NOT NULL,
  data jsonb NOT NULL,
  payload_digest text NOT NULL
);
CREATE INDEX assistant_stream_markers_attempt ON flow.assistant_stream_markers(attempt_id,sequence);
CREATE TABLE flow.assistant_stream_settlements (
  attempt_id text PRIMARY KEY REFERENCES flow.attempts(id),
  task_id text NOT NULL REFERENCES flow.tasks(id),
  final_id text UNIQUE NOT NULL REFERENCES flow.assistant_messages(id),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
