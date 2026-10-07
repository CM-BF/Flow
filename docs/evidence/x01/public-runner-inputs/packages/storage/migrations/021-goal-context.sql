CREATE TABLE flow.goal_contexts (
  id text PRIMARY KEY,
  goal_id text NOT NULL,
  node_id text NOT NULL,
  input_version integer NOT NULL,
  project_id text NOT NULL REFERENCES flow.projects(id),
  context_digest text NOT NULL CHECK(context_digest ~ '^[a-f0-9]{64}$'),
  sources jsonb NOT NULL CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources) BETWEEN 1 AND 4),
  raw_bytes integer NOT NULL CHECK(raw_bytes BETWEEN 0 AND 8192),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(goal_id,node_id,input_version),
  FOREIGN KEY(goal_id,node_id,input_version) REFERENCES flow.goal_inputs(goal_id,node_id,version)
);
CREATE TABLE flow.goal_execution_inputs (
  id text PRIMARY KEY,
  context_id text NOT NULL REFERENCES flow.goal_contexts(id),
  public_prompt text NOT NULL,
  template_version integer NOT NULL CHECK(template_version=1),
  execution_prompt text NOT NULL CHECK(octet_length(execution_prompt)<=49152),
  execution_input_digest text NOT NULL CHECK(execution_input_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE flow.tasks ADD COLUMN goal_input_id text UNIQUE REFERENCES flow.goal_execution_inputs(id);
ALTER TABLE flow.tasks ADD CONSTRAINT task_single_context CHECK(goal_input_id IS NULL OR conversation_input_id IS NULL);
CREATE TRIGGER goal_contexts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_contexts
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TRIGGER goal_execution_inputs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_execution_inputs
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE FUNCTION flow.reject_goal_input_unbinding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.goal_input_id IS NOT NULL AND NEW.goal_input_id IS DISTINCT FROM OLD.goal_input_id THEN
    RAISE EXCEPTION 'Frozen goal execution input binding is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER task_goal_input_immutable BEFORE UPDATE OF goal_input_id ON flow.tasks
  FOR EACH ROW EXECUTE FUNCTION flow.reject_goal_input_unbinding();
