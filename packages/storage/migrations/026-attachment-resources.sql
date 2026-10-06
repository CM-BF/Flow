CREATE TABLE flow.attachment_namespace (
  singleton boolean PRIMARY KEY CHECK(singleton),
  recovery_scope_id uuid NOT NULL UNIQUE
);
CREATE TABLE flow.attachment_resources (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES flow.projects(id),
  version integer NOT NULL DEFAULT 1 CHECK(version=1),
  name text NOT NULL CHECK(octet_length(name) BETWEEN 1 AND 512),
  media_type text NOT NULL CHECK(media_type='text/plain'),
  content text NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 8192),
  content_digest text NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'),
  byte_length integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
  CHECK(expires_at>created_at)
);
CREATE INDEX attachment_resources_project ON flow.attachment_resources(project_id,id);
CREATE TABLE flow.conversation_attachment_bindings (
  context_id text NOT NULL REFERENCES flow.conversation_contexts(id),
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 3),
  resource_id uuid NOT NULL REFERENCES flow.attachment_resources(id),
  PRIMARY KEY(context_id,ordinal), UNIQUE(context_id,resource_id)
);
CREATE INDEX conversation_attachment_resource ON flow.conversation_attachment_bindings(resource_id);
CREATE FUNCTION flow.reject_attachment_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published attachment identity and retained bindings are immutable' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER attachment_namespace_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.attachment_namespace
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_attachment_immutable_mutation();
CREATE TRIGGER attachment_resource_immutable BEFORE UPDATE OR TRUNCATE ON flow.attachment_resources
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_attachment_immutable_mutation();
CREATE TRIGGER conversation_attachment_binding_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.conversation_attachment_bindings
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_attachment_immutable_mutation();

-- Extend representable sources, never weaken the existing immutable row triggers.
ALTER TABLE flow.conversation_contexts ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK(jsonb_typeof(attachments)='array' AND jsonb_array_length(attachments)<=4);
ALTER TABLE flow.conversation_contexts DROP CONSTRAINT conversation_contexts_sources_check;
ALTER TABLE flow.conversation_contexts ADD CONSTRAINT conversation_contexts_sources_check
  CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources)+jsonb_array_length(attachments) BETWEEN 1 AND 4);
ALTER TABLE flow.conversation_execution_inputs DROP CONSTRAINT conversation_execution_inputs_template_version_check;
ALTER TABLE flow.conversation_execution_inputs ADD CONSTRAINT conversation_execution_inputs_template_version_check CHECK(template_version IN (1,2));
