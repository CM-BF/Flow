-- Historical values stay unknown; lease expiry does not reconstruct a heartbeat.
ALTER TABLE flow.attempts ADD COLUMN last_heartbeat_at timestamptz;
ALTER TABLE flow.attempts ADD COLUMN last_event_at timestamptz;
CREATE TABLE flow.reconciliation_audit (
  ordinal bigserial UNIQUE,
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  actor text NOT NULL,
  action text NOT NULL CHECK (action IN ('observation', 'resolution', 'retry')),
  request jsonb NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX reconciliation_task_history ON flow.reconciliation_audit(task_id, ordinal);
CREATE TABLE flow.reconciliation_retries (
  task_id text PRIMARY KEY REFERENCES flow.tasks(id),
  source_task_id text NOT NULL REFERENCES flow.tasks(id),
  source_attempt_id text NOT NULL REFERENCES flow.attempts(id),
  resolution_id text NOT NULL UNIQUE REFERENCES flow.reconciliation_audit(id),
  retry_audit_id text NOT NULL REFERENCES flow.reconciliation_audit(id)
);
CREATE FUNCTION flow.prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Reconciliation audit is append-only' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER reconciliation_audit_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.reconciliation_audit
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_audit_mutation();
CREATE TRIGGER reconciliation_provenance_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.reconciliation_retries
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_audit_mutation();
INSERT INTO flow.migrations(version) VALUES(2);
