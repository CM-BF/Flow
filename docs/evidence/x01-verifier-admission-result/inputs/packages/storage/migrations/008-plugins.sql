CREATE TABLE flow.plugin_installations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES flow.workspaces(id),
  project_id text REFERENCES flow.projects(id),
  package_name text NOT NULL,
  revision integer NOT NULL CHECK(revision > 0),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX plugin_scope_package ON flow.plugin_installations(workspace_id,coalesce(project_id,''),package_name);
CREATE INDEX plugin_scope_list ON flow.plugin_installations(workspace_id,project_id,id);
CREATE TABLE flow.plugin_versions (
  id text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES flow.plugin_installations(id),
  package_version text NOT NULL,
  declaration jsonb NOT NULL CHECK(jsonb_typeof(declaration)='object' AND octet_length(declaration::text)<=65536),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(installation_id,id),
  UNIQUE(installation_id,package_version)
);
CREATE TABLE flow.plugin_revisions (
  installation_id text NOT NULL REFERENCES flow.plugin_installations(id),
  revision integer NOT NULL CHECK(revision > 0),
  version_id text NOT NULL,
  configuration jsonb NOT NULL CHECK(jsonb_typeof(configuration)='object' AND octet_length(configuration::text)<=8192),
  grants jsonb NOT NULL CHECK(jsonb_typeof(grants)='array' AND jsonb_array_length(grants)<=4),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(installation_id,revision),
  FOREIGN KEY(installation_id,version_id) REFERENCES flow.plugin_versions(installation_id,id)
);
ALTER TABLE flow.plugin_installations ADD CONSTRAINT plugin_current_revision
  FOREIGN KEY(id,revision) REFERENCES flow.plugin_revisions(installation_id,revision) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE flow.plugin_operations (
  id text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES flow.plugin_installations(id),
  kind text NOT NULL CHECK(kind IN ('register','configure','set-grants','register-version','select-version')),
  actor text NOT NULL CHECK(actor='owner'),
  input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
  before_revision integer,
  after_revision integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(installation_id,after_revision) REFERENCES flow.plugin_revisions(installation_id,revision),
  UNIQUE(installation_id,after_revision)
);
CREATE INDEX plugin_operation_list ON flow.plugin_operations(installation_id,id);
CREATE FUNCTION flow.prevent_plugin_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Plugin history is immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER plugin_versions_immutable BEFORE UPDATE OR DELETE ON flow.plugin_versions FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_versions_no_truncate BEFORE TRUNCATE ON flow.plugin_versions FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_revisions_immutable BEFORE UPDATE OR DELETE ON flow.plugin_revisions FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_revisions_no_truncate BEFORE TRUNCATE ON flow.plugin_revisions FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_operations_immutable BEFORE UPDATE OR DELETE ON flow.plugin_operations FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_operations_no_truncate BEFORE TRUNCATE ON flow.plugin_operations FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
