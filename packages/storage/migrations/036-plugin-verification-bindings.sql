-- One positive immutable kind per existing binding, derived from its installed receipt.
-- No default/tool inference from absence. Unverifiable historical bindings stop migration.
CREATE TABLE flow.plugin_binding_executions (
  binding_id text PRIMARY KEY REFERENCES flow.plugin_tool_bindings(id),
  kind text NOT NULL CHECK(kind IN ('tool','verifier')),
  UNIQUE(binding_id,kind)
);
CREATE FUNCTION flow.installed_binding_kind(binding flow.plugin_tool_bindings) RETURNS text
LANGUAGE sql STABLE AS $$
 SELECT i.receipt->'manifest'->>'kind' FROM flow.plugin_material_installs i
 WHERE i.id=(binding).material_install_operation_id AND i.registration_id=(binding).registration_id
   AND i.version_id=(binding).version_id AND i.store_id=(binding).store_id AND i.status='installed'
   AND i.receipt->>'schemaVersion'='1' AND i.receipt->>'storeId'=(binding).store_id
   AND i.receipt->>'installationId'=(binding).material_id AND i.receipt->>'treeDigest'=(binding).tree_digest
   AND i.receipt->'manifest'->>'schemaVersion'='1'
   AND i.receipt->'manifest'->>'hostApiMajor'=(binding).host_api_major::text
   AND i.receipt->'manifest'->>'kind' IN ('tool','verifier')
   AND i.receipt->'artifact' @> (binding).artifact AND (binding).artifact @> (i.receipt->'artifact' - ARRAY['format','verifiedAt','source'])
   AND i.artifact @> (binding).artifact AND i.artifact_id=(binding).artifact->>'artifactId'
$$;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM flow.plugin_tool_bindings b WHERE flow.installed_binding_kind(b) IS DISTINCT FROM 'tool') THEN
  RAISE EXCEPTION 'Historical binding has no proven installed tool identity; reconcile before migration' USING ERRCODE='23514';
 END IF;
END $$;
INSERT INTO flow.plugin_binding_executions(binding_id,kind)
 SELECT b.id,flow.installed_binding_kind(b) FROM flow.plugin_tool_bindings b
 WHERE flow.installed_binding_kind(b) IS NOT NULL;
CREATE FUNCTION flow.bind_plugin_execution_kind() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE execution_kind text;
BEGIN
 execution_kind := flow.installed_binding_kind(NEW);
 IF execution_kind IS NULL THEN RAISE EXCEPTION 'Binding requires an exact installed manifest' USING ERRCODE='23514'; END IF;
 INSERT INTO flow.plugin_binding_executions(binding_id,kind) VALUES(NEW.id,execution_kind);
 RETURN NEW;
END;
$$;
CREATE TRIGGER plugin_binding_execution AFTER INSERT ON flow.plugin_tool_bindings
 FOR EACH ROW EXECUTE FUNCTION flow.bind_plugin_execution_kind();
CREATE TRIGGER plugin_binding_executions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.plugin_binding_executions
 FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();

ALTER TABLE flow.artifacts ADD CONSTRAINT plugin_source_artifact_identity UNIQUE(task_id,attempt_id,artifact_id,version);
CREATE TABLE flow.plugin_verification_references (
 binding_id text PRIMARY KEY,
 kind text NOT NULL DEFAULT 'verifier' CHECK(kind='verifier'),
 source_task_id text NOT NULL,
 source_attempt_id text NOT NULL,
 artifact_id text NOT NULL,
 artifact_version text NOT NULL CHECK(artifact_version ~ '^[a-f0-9]{64}$'),
 project_id text NOT NULL REFERENCES flow.projects(id),
 rule jsonb NOT NULL CHECK(jsonb_typeof(rule)='object' AND octet_length(rule::text)<=8192
   AND rule ?& ARRAY['schemaVersion','algorithmId','algorithmVersion','requiredKeys']
   AND rule->>'schemaVersion'='1' AND jsonb_typeof(rule->'requiredKeys')='array' AND jsonb_array_length(rule->'requiredKeys')<=32
   AND rule->>'algorithmId'='flow.json-object.required-keys' AND rule->>'algorithmVersion'='1'),
 FOREIGN KEY(binding_id,kind) REFERENCES flow.plugin_binding_executions(binding_id,kind),
 FOREIGN KEY(source_task_id,source_attempt_id,artifact_id,artifact_version) REFERENCES flow.artifacts(task_id,attempt_id,artifact_id,version)
);
CREATE TRIGGER plugin_verification_references_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.plugin_verification_references
 FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_plugin_history_mutation();
CREATE FUNCTION flow.require_plugin_verification_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind='verifier' AND NOT EXISTS(SELECT 1 FROM flow.plugin_verification_references WHERE binding_id=NEW.binding_id) THEN
  RAISE EXCEPTION 'Verifier binding requires its immutable source reference' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER plugin_verification_reference_required AFTER INSERT ON flow.plugin_binding_executions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION flow.require_plugin_verification_reference();

CREATE FUNCTION flow.validate_plugin_execution_kind() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proven_kind text;
BEGIN
 SELECT flow.installed_binding_kind(b) INTO proven_kind FROM flow.plugin_tool_bindings b WHERE b.id=NEW.binding_id;
 IF proven_kind IS DISTINCT FROM NEW.kind THEN RAISE EXCEPTION 'Execution kind must match installed manifest' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER plugin_execution_kind_valid BEFORE INSERT ON flow.plugin_binding_executions FOR EACH ROW EXECUTE FUNCTION flow.validate_plugin_execution_kind();
