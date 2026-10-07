ALTER TABLE flow.conversations ADD COLUMN project_id text REFERENCES flow.projects(id);
CREATE TABLE flow.conversation_contexts (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES flow.conversations(id),
  project_id text NOT NULL REFERENCES flow.projects(id),
  context_digest text NOT NULL CHECK(context_digest ~ '^[a-f0-9]{64}$'),
  sources jsonb NOT NULL CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources) BETWEEN 1 AND 4),
  raw_bytes integer NOT NULL CHECK(raw_bytes BETWEEN 0 AND 8192),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX conversation_contexts_owner ON flow.conversation_contexts(conversation_id,id);
CREATE TABLE flow.conversation_execution_inputs (
  id text PRIMARY KEY,
  context_id text NOT NULL REFERENCES flow.conversation_contexts(id),
  user_text text NOT NULL,
  template_version integer NOT NULL CHECK(template_version=1),
  execution_prompt text NOT NULL CHECK(octet_length(execution_prompt)<=49152),
  execution_input_digest text NOT NULL CHECK(execution_input_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE flow.tasks ADD COLUMN conversation_input_id text UNIQUE REFERENCES flow.conversation_execution_inputs(id);
ALTER TABLE flow.conversation_queue ADD COLUMN conversation_input_id text REFERENCES flow.conversation_execution_inputs(id);
ALTER TABLE flow.conversation_turns ADD COLUMN conversation_input_id text REFERENCES flow.conversation_execution_inputs(id);
CREATE FUNCTION flow.reject_conversation_context_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Frozen conversation context and execution inputs are immutable' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER conversation_contexts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.conversation_contexts
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_conversation_context_mutation();
CREATE TRIGGER conversation_execution_inputs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.conversation_execution_inputs
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_conversation_context_mutation();
CREATE FUNCTION flow.reject_conversation_project_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN RAISE EXCEPTION 'Conversation project is immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER conversation_project_immutable BEFORE UPDATE OF project_id ON flow.conversations
  FOR EACH ROW EXECUTE FUNCTION flow.reject_conversation_project_mutation();

CREATE FUNCTION flow.reject_conversation_input_unbinding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.conversation_input_id IS NOT NULL AND NEW.conversation_input_id IS DISTINCT FROM OLD.conversation_input_id THEN
    RAISE EXCEPTION 'Frozen execution input binding is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER task_conversation_input_immutable BEFORE UPDATE OF conversation_input_id ON flow.tasks
  FOR EACH ROW EXECUTE FUNCTION flow.reject_conversation_input_unbinding();
CREATE TRIGGER queue_conversation_input_immutable BEFORE UPDATE OF conversation_input_id ON flow.conversation_queue
  FOR EACH ROW EXECUTE FUNCTION flow.reject_conversation_input_unbinding();
CREATE TRIGGER turn_conversation_input_immutable BEFORE UPDATE OF conversation_input_id ON flow.conversation_turns
  FOR EACH ROW EXECUTE FUNCTION flow.reject_conversation_input_unbinding();
