CREATE TABLE flow.plugin_package_fetches (
  id text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES flow.plugin_installations(id),
  version_id text NOT NULL,
  admitted_revision integer NOT NULL CHECK(admitted_revision > 0),
  package_name text NOT NULL, package_version text NOT NULL,
  expected_sha256 text NOT NULL CHECK(expected_sha256 ~ '^[a-f0-9]{64}$'),
  integrity text NOT NULL CHECK(length(integrity)=95),
  store_id text NOT NULL, registry_ref text NOT NULL, registry_url text NOT NULL,
  current_attempt_id text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(installation_id,version_id) REFERENCES flow.plugin_versions(installation_id,id)
);
CREATE TABLE flow.plugin_package_fetch_attempts (
  id text PRIMARY KEY,
  operation_id text NOT NULL REFERENCES flow.plugin_package_fetches(id),
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 3),
  artifact_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN ('queued','running','recovering','interrupted','failed','succeeded')),
  worker_id text, error text,
  artifact jsonb CHECK(artifact IS NULL OR (jsonb_typeof(artifact)='object' AND octet_length(artifact::text)<=8192)),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(operation_id,ordinal), UNIQUE(operation_id,id),
  CHECK((status='succeeded') = (artifact IS NOT NULL))
);
ALTER TABLE flow.plugin_package_fetches ADD CONSTRAINT package_fetch_current_attempt
  FOREIGN KEY(id,current_attempt_id) REFERENCES flow.plugin_package_fetch_attempts(operation_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX package_fetch_store_queue ON flow.plugin_package_fetches(store_id,created_at,id);
CREATE INDEX package_fetch_installation ON flow.plugin_package_fetches(installation_id,id);
CREATE TABLE flow.plugin_package_fetch_audit (
  cursor bigserial PRIMARY KEY,
  operation_id text NOT NULL REFERENCES flow.plugin_package_fetches(id),
  attempt_id text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('admitted','retry','reconcile','running','succeeded','failed','interrupted')),
  actor jsonb NOT NULL CHECK(jsonb_typeof(actor)='object' AND octet_length(actor::text)<=1024),
  reason text CHECK(length(reason)<=512), error text,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(operation_id,attempt_id) REFERENCES flow.plugin_package_fetch_attempts(operation_id,id)
);
CREATE INDEX package_fetch_audit_page ON flow.plugin_package_fetch_audit(operation_id,cursor);
CREATE TRIGGER package_fetch_audit_immutable BEFORE UPDATE OR DELETE ON flow.plugin_package_fetch_audit
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER package_fetch_audit_no_truncate BEFORE TRUNCATE ON flow.plugin_package_fetch_audit
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
