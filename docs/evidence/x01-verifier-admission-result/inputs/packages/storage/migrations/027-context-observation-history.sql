-- Composite references enforce the same task/attempt ownership as the store.
-- Existing primary keys already make these combinations unique; these indexes
-- allow PostgreSQL to enforce their use as foreign-key targets.
CREATE UNIQUE INDEX context_history_attempt_owner ON flow.attempts(id, task_id);
CREATE UNIQUE INDEX context_history_detail_owner ON flow.details(id, task_id, attempt_id);

CREATE TABLE flow.context_observations (
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL,
  observation_id text NOT NULL CHECK (observation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  event_sequence integer NOT NULL CHECK (event_sequence > 0),
  wire_canonical text NOT NULL CHECK (octet_length(wire_canonical) BETWEEN 1 AND 65536),
  wire_digest text NOT NULL CHECK (wire_digest ~ '^[a-f0-9]{64}$'),
  sample jsonb NOT NULL CHECK (jsonb_typeof(sample) = 'object' AND octet_length(sample::text) <= 65536),
  detail_id text UNIQUE NOT NULL,
  observed_at timestamptz NOT NULL CHECK (isfinite(observed_at)),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(received_at)),
  PRIMARY KEY (attempt_id, observation_id),
  UNIQUE (attempt_id, event_sequence),
  FOREIGN KEY (attempt_id, task_id) REFERENCES flow.attempts(id, task_id),
  FOREIGN KEY (detail_id, task_id, attempt_id) REFERENCES flow.details(id, task_id, attempt_id)
);
CREATE INDEX context_observations_latest ON flow.context_observations(task_id, attempt_id, event_sequence DESC);

CREATE FUNCTION flow.reject_context_observation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Context observation history is immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER context_observations_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.context_observations
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_context_observation_mutation();
