-- Provenance stays in the existing text columns: old owner rows and pre-017 owner-only consumers remain unchanged.
CREATE FUNCTION flow.is_goal_graph_actor(value text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE actor jsonb; field text;
BEGIN
  actor := value::jsonb;
  IF jsonb_typeof(actor) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['runId','runnerId','taskId','attemptId'] LOOP
    IF jsonb_typeof(actor->field) IS DISTINCT FROM 'string' OR length(actor->>field) NOT BETWEEN 1 AND 128 THEN RETURN false; END IF;
  END LOOP;
  RETURN COALESCE(actor->>'kind'='goal-graph-run' AND jsonb_typeof(actor->'ownerVersion')='number'
    AND actor->>'ownerVersion' ~ '^[1-9][0-9]*$' AND (actor->>'ownerVersion')::bigint<=2147483647, false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE flow.project_revisions DROP CONSTRAINT project_revisions_actor_check;
ALTER TABLE flow.project_revisions ADD CHECK(actor='owner' OR flow.is_goal_graph_actor(actor));
ALTER TABLE flow.goal_graph_proposals DROP CONSTRAINT goal_graph_proposals_source_check;
ALTER TABLE flow.goal_graph_proposals ADD CHECK(source='owner-submission' OR flow.is_goal_graph_actor(source));
ALTER TABLE flow.goal_graph_applications DROP CONSTRAINT goal_graph_applications_actor_check;
ALTER TABLE flow.goal_graph_applications ADD CHECK(actor='owner' OR flow.is_goal_graph_actor(actor));
CREATE TABLE flow.goal_graph_runs (
  id text PRIMARY KEY, goal_id text NOT NULL REFERENCES flow.goals(id),
  task_id text NOT NULL UNIQUE REFERENCES flow.tasks(id), version integer NOT NULL CHECK(version=1),
  scope jsonb NOT NULL, mode text NOT NULL CHECK(mode='fixture'), used_commands integer NOT NULL DEFAULT 0 CHECK(used_commands BETWEEN 0 AND 3),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz(3), revocation_reason text,
  CHECK ((revoked_at IS NULL) = (revocation_reason IS NULL))
);
CREATE TRIGGER goal_graph_run_immutable BEFORE UPDATE ON flow.goal_graph_runs FOR EACH ROW EXECUTE FUNCTION flow.protect_goal_tool_run();
CREATE TRIGGER goal_graph_run_no_delete BEFORE DELETE OR TRUNCATE ON flow.goal_graph_runs FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TABLE flow.goal_graph_calls (
  run_id text NOT NULL REFERENCES flow.goal_graph_runs(id), sequence integer NOT NULL CHECK(sequence>0),
  runner_id text NOT NULL REFERENCES flow.runners(id), attempt_id text NOT NULL REFERENCES flow.attempts(id), owner_version integer NOT NULL CHECK(owner_version>0),
  command_key text NOT NULL, digest text NOT NULL, kind text NOT NULL CHECK(kind IN ('propose','apply')),
  proposal_id text NOT NULL REFERENCES flow.goal_graph_proposals(id), proposal_digest text NOT NULL,
  applied_revision integer, created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(run_id,sequence), UNIQUE(run_id,command_key)
);
CREATE TRIGGER goal_graph_calls_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_graph_calls FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
