-- Runtime commands share the original registration revision and operation audit.
ALTER TABLE flow.plugin_operations DROP CONSTRAINT plugin_operations_kind_check;
ALTER TABLE flow.plugin_operations ADD CONSTRAINT plugin_operations_kind_check
  CHECK(kind IN ('register','configure','set-grants','register-version','select-version','enable','disable'));
ALTER TABLE flow.plugin_revisions ADD CONSTRAINT plugin_revision_version_identity
  UNIQUE(installation_id,revision,version_id);
-- Installation admission may have registered a not-yet-selected version. Do not
-- constrain its historical admitted revision to that version; enable checks the current selection.
ALTER TABLE flow.plugin_material_installs ADD CONSTRAINT plugin_runtime_material_identity
  UNIQUE(id,registration_id,version_id,store_id);

CREATE TABLE flow.plugin_runtime_hosts (
  runner_id text PRIMARY KEY REFERENCES flow.runners(id),
  store_id text NOT NULL CHECK(store_id ~ '^[a-zA-Z0-9_-]{1,64}$'),
  host_api_major integer NOT NULL CHECK(host_api_major=1),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(runner_id,store_id,host_api_major)
);
CREATE TRIGGER plugin_runtime_hosts_immutable BEFORE UPDATE OR DELETE ON flow.plugin_runtime_hosts
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_runtime_hosts_no_truncate BEFORE TRUNCATE ON flow.plugin_runtime_hosts
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();

CREATE TABLE flow.plugin_runtime_revisions (
  registration_id text NOT NULL,
  revision integer NOT NULL,
  version_id text NOT NULL,
  desired_enabled boolean NOT NULL,
  material_install_operation_id text,
  target_runner_id text,
  store_id text,
  host_api_major integer,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(registration_id,revision),
  FOREIGN KEY(registration_id,revision,version_id)
    REFERENCES flow.plugin_revisions(installation_id,revision,version_id),
  FOREIGN KEY(material_install_operation_id,registration_id,version_id,store_id)
    REFERENCES flow.plugin_material_installs(id,registration_id,version_id,store_id),
  FOREIGN KEY(target_runner_id,store_id,host_api_major)
    REFERENCES flow.plugin_runtime_hosts(runner_id,store_id,host_api_major),
  CHECK((desired_enabled AND material_install_operation_id IS NOT NULL AND target_runner_id IS NOT NULL
      AND store_id IS NOT NULL AND host_api_major IS NOT NULL AND host_api_major=1)
    OR (NOT desired_enabled AND material_install_operation_id IS NULL AND target_runner_id IS NULL
      AND store_id IS NULL AND host_api_major IS NULL)),
  UNIQUE(registration_id,revision,version_id,material_install_operation_id,target_runner_id,store_id,host_api_major)
);
CREATE TRIGGER plugin_runtime_revisions_immutable BEFORE UPDATE OR DELETE ON flow.plugin_runtime_revisions
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_runtime_revisions_no_truncate BEFORE TRUNCATE ON flow.plugin_runtime_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();

CREATE TABLE flow.plugin_tool_bindings (
  id text PRIMARY KEY,
  invocation_id text NOT NULL UNIQUE,
  task_id text NOT NULL UNIQUE REFERENCES flow.tasks(id),
  registration_id text NOT NULL,
  registration_revision integer NOT NULL,
  version_id text NOT NULL,
  scope jsonb NOT NULL CHECK(jsonb_typeof(scope)='object' AND octet_length(scope::text)<=512),
  material_install_operation_id text NOT NULL,
  target_runner_id text NOT NULL,
  store_id text NOT NULL,
  material_id text NOT NULL CHECK(material_id ~ '^[a-f0-9]{64}$'),
  tree_digest text NOT NULL CHECK(tree_digest ~ '^[a-f0-9]{64}$'),
  host_api_major integer NOT NULL CHECK(host_api_major=1),
  artifact jsonb NOT NULL CHECK(jsonb_typeof(artifact)='object' AND octet_length(artifact::text)<=4096
    AND artifact ?& ARRAY['artifactId','name','version','bytes','sha256','integrity']),
  configuration jsonb NOT NULL CHECK(jsonb_typeof(configuration)='object' AND octet_length(configuration::text)<=8192),
  input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(registration_id,registration_revision,version_id,material_install_operation_id,target_runner_id,store_id,host_api_major)
    REFERENCES flow.plugin_runtime_revisions(registration_id,revision,version_id,material_install_operation_id,target_runner_id,store_id,host_api_major),
  UNIQUE(id,invocation_id,task_id,target_runner_id),
  UNIQUE(id,registration_id)
);
CREATE INDEX plugin_tool_binding_registration ON flow.plugin_tool_bindings(registration_id,created_at,id);
CREATE TRIGGER plugin_tool_bindings_immutable BEFORE UPDATE OR DELETE ON flow.plugin_tool_bindings
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_tool_bindings_no_truncate BEFORE TRUNCATE ON flow.plugin_tool_bindings
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();

ALTER TABLE flow.attempts ADD CONSTRAINT plugin_attempt_owner_identity UNIQUE(id,task_id,runner_id,owner_version);
CREATE TABLE flow.plugin_tool_authorizations (
  binding_id text NOT NULL,
  invocation_id text NOT NULL,
  phase text NOT NULL CHECK(phase IN ('load','invoke')),
  task_id text NOT NULL,
  attempt_id text NOT NULL,
  owner_version integer NOT NULL CHECK(owner_version>0),
  runner_id text NOT NULL,
  registration_id text NOT NULL,
  authorized_revision integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  -- Changing the HTTP idempotency key never grants a second execution of this phase.
  PRIMARY KEY(binding_id,invocation_id,phase),
  FOREIGN KEY(binding_id,invocation_id,task_id,runner_id)
    REFERENCES flow.plugin_tool_bindings(id,invocation_id,task_id,target_runner_id),
  FOREIGN KEY(binding_id,registration_id) REFERENCES flow.plugin_tool_bindings(id,registration_id),
  FOREIGN KEY(attempt_id,task_id,runner_id,owner_version)
    REFERENCES flow.attempts(id,task_id,runner_id,owner_version),
  FOREIGN KEY(registration_id,authorized_revision) REFERENCES flow.plugin_revisions(installation_id,revision)
);
CREATE TRIGGER plugin_tool_authorizations_immutable BEFORE UPDATE OR DELETE ON flow.plugin_tool_authorizations
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_tool_authorizations_no_truncate BEFORE TRUNCATE ON flow.plugin_tool_authorizations
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
