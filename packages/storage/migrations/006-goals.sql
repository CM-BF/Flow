CREATE TABLE flow.goals (
  id text PRIMARY KEY, project_id text NOT NULL UNIQUE REFERENCES flow.projects(id),
  original jsonb NOT NULL, explanation_version integer NOT NULL DEFAULT 0,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE flow.goal_inputs (
  goal_id text NOT NULL REFERENCES flow.goals(id), node_id text NOT NULL, version integer NOT NULL CHECK(version>0),
  input jsonb NOT NULL, project_revision integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(goal_id,node_id,version)
);
CREATE TABLE flow.goal_executions (
  id text PRIMARY KEY, goal_id text NOT NULL REFERENCES flow.goals(id), node_id text NOT NULL,
  task_id text NOT NULL UNIQUE REFERENCES flow.tasks(id), input_version integer NOT NULL,
  dependencies jsonb NOT NULL, project_revision integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(goal_id,node_id,input_version) REFERENCES flow.goal_inputs(goal_id,node_id,version)
);
CREATE INDEX goal_execution_page ON flow.goal_executions(goal_id,node_id,id);
CREATE TABLE flow.goal_nodes (
  goal_id text NOT NULL REFERENCES flow.goals(id), node_id text NOT NULL, input_version integer NOT NULL,
  latest_execution_id text REFERENCES flow.goal_executions(id), accepted_binding jsonb,
  PRIMARY KEY(goal_id,node_id),
  FOREIGN KEY(goal_id,node_id,input_version) REFERENCES flow.goal_inputs(goal_id,node_id,version)
);
CREATE TABLE flow.goal_explanations (
  goal_id text NOT NULL REFERENCES flow.goals(id), version integer NOT NULL,
  kind text NOT NULL, text text NOT NULL, source jsonb NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(goal_id,version)
);
CREATE TABLE flow.goal_acceptances (
  goal_id text NOT NULL REFERENCES flow.goals(id), explanation_version integer NOT NULL,
  binding jsonb NOT NULL, PRIMARY KEY(goal_id,explanation_version),
  FOREIGN KEY(goal_id,explanation_version) REFERENCES flow.goal_explanations(goal_id,version)
);
CREATE FUNCTION flow.reject_goal_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Goal history is immutable' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER goal_inputs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_inputs
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TRIGGER goal_executions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_executions
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TRIGGER goal_explanations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_explanations
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TRIGGER goal_acceptances_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_acceptances
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();

CREATE INDEX goal_input_explanation ON flow.goal_explanations(goal_id,(source->>'nodeId'),(source->>'inputVersion')) WHERE kind='define-input';
CREATE INDEX goal_delivery_explanation ON flow.goal_acceptances(goal_id,(binding->>'executionId'),explanation_version DESC);
