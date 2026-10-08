CREATE TABLE flow.goal_tool_runs (
  id text PRIMARY KEY, goal_id text NOT NULL REFERENCES flow.goals(id),
  task_id text NOT NULL UNIQUE REFERENCES flow.tasks(id), version integer NOT NULL CHECK(version=1),
  scope jsonb NOT NULL, mode text NOT NULL CHECK(mode='fixture'), used_commands integer NOT NULL DEFAULT 0 CHECK(used_commands>=0 AND used_commands<=32),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz(3), revocation_reason text,
  CHECK ((revoked_at IS NULL) = (revocation_reason IS NULL))
);
CREATE TABLE flow.goal_tool_calls (
  run_id text NOT NULL REFERENCES flow.goal_tool_runs(id), sequence integer NOT NULL CHECK(sequence>0),
  attempt_id text NOT NULL REFERENCES flow.attempts(id), owner_version integer NOT NULL CHECK(owner_version>0),
  command_key text NOT NULL, digest text NOT NULL, kind text NOT NULL, node_id text NOT NULL,
  result jsonb NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(run_id,sequence), UNIQUE(run_id,command_key)
);
CREATE FUNCTION flow.protect_goal_tool_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.goal_id,NEW.task_id,NEW.version,NEW.scope,NEW.mode,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.goal_id,OLD.task_id,OLD.version,OLD.scope,OLD.mode,OLD.created_at)
    OR (OLD.revoked_at IS NOT NULL AND (NEW.revoked_at,NEW.revocation_reason) IS DISTINCT FROM (OLD.revoked_at,OLD.revocation_reason))
    OR NEW.used_commands<OLD.used_commands THEN
    RAISE EXCEPTION 'Goal tool authority is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goal_tool_run_immutable BEFORE UPDATE ON flow.goal_tool_runs FOR EACH ROW EXECUTE FUNCTION flow.protect_goal_tool_run();
CREATE TRIGGER goal_tool_run_no_delete BEFORE DELETE OR TRUNCATE ON flow.goal_tool_runs FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TRIGGER goal_tool_calls_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_tool_calls FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
