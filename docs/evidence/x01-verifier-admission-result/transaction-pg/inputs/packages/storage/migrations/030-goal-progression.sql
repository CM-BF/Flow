CREATE TABLE flow.goal_progressions (
  id text PRIMARY KEY, goal_id text NOT NULL REFERENCES flow.goals(id), project_id text NOT NULL REFERENCES flow.projects(id),
  manifest jsonb NOT NULL, authorization_digest text NOT NULL CHECK(authorization_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz(3) NOT NULL,
  revoked_at timestamptz(3), revocation_reason text, finished_at timestamptz(3), halted jsonb,
  checked_at timestamptz(3) NOT NULL DEFAULT '-infinity',
  CHECK((manifest->>'protocol') IS NOT DISTINCT FROM 'flow.goal-progression.v1'),
  CHECK((manifest->>'intermediatePolicy') IS NOT DISTINCT FROM 'verified-artifact-within-this-authorization'),
  CHECK(COALESCE(jsonb_typeof(manifest->'nodes')='array' AND jsonb_array_length(manifest->'nodes') BETWEEN 1 AND 20,false)),
  CHECK(COALESCE((manifest->>'maxAdmissions')::integer BETWEEN 1 AND jsonb_array_length(manifest->'nodes'),false)),
  CHECK(octet_length(manifest::text)<=65536),
  CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours'),
  CHECK((revoked_at IS NULL)=(revocation_reason IS NULL))
);
CREATE UNIQUE INDEX goal_progression_one_active ON flow.goal_progressions(goal_id) WHERE revoked_at IS NULL AND finished_at IS NULL;
CREATE INDEX goal_progression_scan ON flow.goal_progressions(checked_at,id) WHERE revoked_at IS NULL AND finished_at IS NULL AND halted IS NULL;
CREATE FUNCTION flow.protect_goal_progression() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.goal_id,NEW.project_id,NEW.manifest,NEW.authorization_digest,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM (OLD.id,OLD.goal_id,OLD.project_id,OLD.manifest,OLD.authorization_digest,OLD.created_at,OLD.expires_at)
    OR (OLD.revoked_at IS NOT NULL AND (NEW.revoked_at,NEW.revocation_reason) IS DISTINCT FROM (OLD.revoked_at,OLD.revocation_reason))
    OR (OLD.finished_at IS NOT NULL AND NEW.finished_at IS DISTINCT FROM OLD.finished_at)
    OR (OLD.halted IS NOT NULL AND NEW.halted IS DISTINCT FROM OLD.halted)
    OR NEW.checked_at<OLD.checked_at THEN
    RAISE EXCEPTION 'Immutable goal progression authority/history' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goal_progression_immutable BEFORE UPDATE ON flow.goal_progressions FOR EACH ROW EXECUTE FUNCTION flow.protect_goal_progression();
CREATE TRIGGER goal_progression_no_delete BEFORE DELETE OR TRUNCATE ON flow.goal_progressions FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TABLE flow.goal_progression_executions (
  progression_id text NOT NULL REFERENCES flow.goal_progressions(id), node_id text NOT NULL,
  execution_id text NOT NULL UNIQUE REFERENCES flow.goal_executions(id), created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(progression_id,node_id)
);
CREATE FUNCTION flow.check_goal_progression_execution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p flow.goal_progressions; e flow.goal_executions; selection jsonb;
BEGIN
  SELECT * INTO p FROM flow.goal_progressions WHERE id=NEW.progression_id FOR UPDATE;
  SELECT * INTO e FROM flow.goal_executions WHERE id=NEW.execution_id;
  SELECT value INTO selection FROM jsonb_array_elements(p.manifest->'nodes') WHERE value->>'nodeId'=NEW.node_id;
  IF selection IS NULL OR e.goal_id IS DISTINCT FROM p.goal_id OR e.node_id IS DISTINCT FROM NEW.node_id
    OR e.input_version IS DISTINCT FROM (selection->>'inputVersion')::integer
    OR e.project_revision IS DISTINCT FROM (p.manifest->>'projectRevision')::integer
    OR p.revoked_at IS NOT NULL OR p.finished_at IS NOT NULL OR p.halted IS NOT NULL OR p.expires_at<=clock_timestamp()
    OR (SELECT count(*) FROM flow.goal_progression_executions WHERE progression_id=p.id)>=(p.manifest->>'maxAdmissions')::integer THEN
    RAISE EXCEPTION 'Goal execution outside immutable progression authority' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goal_progression_execution_binding BEFORE INSERT ON flow.goal_progression_executions FOR EACH ROW EXECUTE FUNCTION flow.check_goal_progression_execution();
CREATE TRIGGER goal_progression_execution_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_progression_executions FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
