CREATE TABLE flow.protocol_intents (
  attempt_id text PRIMARY KEY REFERENCES flow.attempts(id),
  task_id text NOT NULL REFERENCES flow.tasks(id),
  owner_version integer NOT NULL,
  endpoint_ref text NOT NULL,
  endpoint_digest text NOT NULL CHECK (endpoint_digest ~ '^[a-f0-9]{64}$'),
  command_id text NOT NULL UNIQUE,
  phase text NOT NULL CHECK (phase IN ('prepared','sending','bound','uncertain')),
  remote_task_id text,
  cancel_started boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CHECK (phase <> 'bound' OR remote_task_id IS NOT NULL)
);
CREATE INDEX protocol_intents_task ON flow.protocol_intents(task_id);
INSERT INTO flow.migrations(version) VALUES(5);
