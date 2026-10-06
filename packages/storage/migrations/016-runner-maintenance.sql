ALTER TABLE flow.runners
  ADD COLUMN maintenance_state text NOT NULL DEFAULT 'accepting' CHECK(maintenance_state IN ('accepting','draining','maintenance')),
  ADD COLUMN maintenance_version integer NOT NULL DEFAULT 0 CHECK(maintenance_version >= 0),
  ADD COLUMN maintenance_operation_id text,
  ADD COLUMN maintenance_updated_at timestamptz,
  ADD CONSTRAINT maintenance_operation CHECK((maintenance_state='accepting')=(maintenance_operation_id IS NULL));

CREATE TABLE flow.runner_maintenance_audit (
  ordinal bigserial PRIMARY KEY,
  id text NOT NULL UNIQUE,
  runner_id text NOT NULL REFERENCES flow.runners(id),
  request_id text NOT NULL,
  digest text NOT NULL,
  result jsonb NOT NULL,
  UNIQUE(runner_id,request_id)
);
CREATE FUNCTION flow.reject_maintenance_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Runner maintenance audit is immutable' USING ERRCODE='55000';
END;
$$;
CREATE TRIGGER immutable_runner_maintenance_audit BEFORE UPDATE OR DELETE ON flow.runner_maintenance_audit
FOR EACH ROW EXECUTE FUNCTION flow.reject_maintenance_audit_change();

-- Existing 75a33 claims already lock this row. Rechecking inside the insert also protects
-- a legacy caller that does not understand maintenance; its complete transaction rolls back.
CREATE FUNCTION flow.guard_attempt_maintenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE admission text;
BEGIN
  SELECT maintenance_state INTO admission FROM flow.runners WHERE id=NEW.runner_id FOR UPDATE;
  IF admission IS DISTINCT FROM 'accepting' THEN
    RAISE EXCEPTION 'Runner is not accepting new attempts' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_attempt_maintenance BEFORE INSERT ON flow.attempts
FOR EACH ROW EXECUTE FUNCTION flow.guard_attempt_maintenance();
