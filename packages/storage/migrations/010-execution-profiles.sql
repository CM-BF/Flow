CREATE TABLE flow.execution_profiles (
  id text PRIMARY KEY,
  runner_id text NOT NULL UNIQUE REFERENCES flow.runners(id),
  config_digest text NOT NULL CHECK(config_digest ~ '^[a-f0-9]{64}$'),
  configuration jsonb NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION flow.reject_execution_profile_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Execution profiles are immutable; register a new runner identity' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER execution_profiles_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.execution_profiles
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_execution_profile_mutation();
ALTER TABLE flow.conversations ADD COLUMN execution_profile jsonb;
