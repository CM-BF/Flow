CREATE TABLE flow.steering_attempts (
  attempt_id text PRIMARY KEY REFERENCES flow.attempts(id),
  task_id text NOT NULL REFERENCES flow.tasks(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0),
  seal jsonb
);
CREATE TABLE flow.steering_commands (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.steering_attempts(attempt_id),
  owner_version integer NOT NULL,
  native_session_id text NOT NULL,
  revision integer NOT NULL,
  user_message_uuid uuid UNIQUE NOT NULL,
  text text NOT NULL CHECK(octet_length(text) BETWEEN 1 AND 16384),
  input_digest text NOT NULL,
  status text NOT NULL CHECK(status IN ('accepted','received','observed-consumed','rejected','unknown')),
  receipt_revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(attempt_id,revision)
);
CREATE UNIQUE INDEX steering_one_pending ON flow.steering_commands(attempt_id) WHERE status IN ('accepted','received','unknown');
CREATE INDEX steering_task_page ON flow.steering_commands(task_id,attempt_id,revision);
CREATE TABLE flow.steering_audit (
  ordinal bigserial PRIMARY KEY,
  id text UNIQUE NOT NULL,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  command_id text REFERENCES flow.steering_commands(id),
  action text NOT NULL,
  actor text NOT NULL CHECK(actor IN ('owner','runner')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX steering_audit_page ON flow.steering_audit(task_id,ordinal);
CREATE FUNCTION flow.steering_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Steering audit is immutable' USING ERRCODE='55000'; END;
$$;
CREATE TRIGGER steering_audit_immutable BEFORE UPDATE OR DELETE ON flow.steering_audit FOR EACH ROW EXECUTE FUNCTION flow.steering_audit_immutable();
