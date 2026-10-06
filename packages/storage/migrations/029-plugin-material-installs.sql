ALTER TABLE flow.plugin_package_fetches ADD CONSTRAINT package_fetch_install_identity UNIQUE(id,installation_id,version_id);
ALTER TABLE flow.plugin_package_fetch_attempts ADD CONSTRAINT package_fetch_artifact_identity UNIQUE(operation_id,id,artifact_id);
CREATE TABLE flow.plugin_material_installs (
  id text PRIMARY KEY,
  registration_id text NOT NULL,
  version_id text NOT NULL,
  admitted_revision integer NOT NULL CHECK(admitted_revision > 0),
  fetch_operation_id text NOT NULL,
  fetch_attempt_id text NOT NULL,
  artifact_id text NOT NULL,
  artifact_store_id text NOT NULL,
  store_id text NOT NULL,
  artifact jsonb NOT NULL CHECK(jsonb_typeof(artifact)='object' AND octet_length(artifact::text)<=8192),
  input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK(status IN ('accepted','preparing','installed','failed','unknown')),
  execution_id text,
  receipt jsonb CHECK(receipt IS NULL OR (jsonb_typeof(receipt)='object' AND octet_length(receipt::text)<=32768)),
  error text CHECK(error IN ('material_rejected','artifact_unavailable','cancelled','outcome_unknown','lifecycle_unknown')),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(registration_id,version_id) REFERENCES flow.plugin_versions(installation_id,id),
  FOREIGN KEY(registration_id,admitted_revision) REFERENCES flow.plugin_revisions(installation_id,revision),
  FOREIGN KEY(fetch_operation_id,registration_id,version_id) REFERENCES flow.plugin_package_fetches(id,installation_id,version_id),
  FOREIGN KEY(fetch_operation_id,fetch_attempt_id,artifact_id) REFERENCES flow.plugin_package_fetch_attempts(operation_id,id,artifact_id),
  CHECK((status='accepted') = (execution_id IS NULL)),
  CHECK((status='installed') = (receipt IS NOT NULL)),
  CHECK(status NOT IN ('accepted','preparing','installed') OR error IS NULL)
);
CREATE INDEX plugin_material_install_history ON flow.plugin_material_installs(registration_id,id);
CREATE INDEX plugin_material_install_unsettled ON flow.plugin_material_installs(store_id) WHERE status IN ('preparing','unknown');
CREATE FUNCTION flow.protect_plugin_material_install() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Material installation history is immutable' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(OLD) - ARRAY['status','execution_id','receipt','error','updated_at']) IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['status','execution_id','receipt','error','updated_at']) OR
     (OLD.execution_id IS NOT NULL AND OLD.execution_id IS DISTINCT FROM NEW.execution_id) OR
     OLD.status IN ('installed','failed') OR
     NOT ((OLD.status='accepted' AND NEW.status='preparing') OR
          (OLD.status IN ('preparing','unknown') AND NEW.status IN ('installed','failed','unknown'))) THEN
    RAISE EXCEPTION 'Invalid material installation transition' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER plugin_material_install_update BEFORE UPDATE OR DELETE ON flow.plugin_material_installs FOR EACH ROW EXECUTE FUNCTION flow.protect_plugin_material_install();
CREATE TRIGGER plugin_material_install_no_truncate BEFORE TRUNCATE ON flow.plugin_material_installs FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TABLE flow.plugin_material_install_audit (
  cursor bigserial PRIMARY KEY,
  operation_id text NOT NULL REFERENCES flow.plugin_material_installs(id),
  kind text NOT NULL CHECK(kind IN ('admitted','start','reconcile','preparing','installed','failed','unknown')),
  actor jsonb NOT NULL CHECK(jsonb_typeof(actor)='object' AND octet_length(actor::text)<=512),
  reason text CHECK(length(reason)<=512),
  error text CHECK(error IN ('material_rejected','artifact_unavailable','cancelled','outcome_unknown','lifecycle_unknown')),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX plugin_material_install_audit_page ON flow.plugin_material_install_audit(operation_id,cursor);
CREATE TRIGGER plugin_material_install_audit_immutable BEFORE UPDATE OR DELETE ON flow.plugin_material_install_audit FOR EACH ROW EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE TRIGGER plugin_material_install_audit_no_truncate BEFORE TRUNCATE ON flow.plugin_material_install_audit FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
