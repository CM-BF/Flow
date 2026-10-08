-- Canonical UTF-8 1024B is enforced by the shared TypeScript codec. This separate
-- 4096B bound measures PostgreSQL's spaced jsonb text, not canonical or disk bytes.
CREATE FUNCTION flow.valid_claude_message_settings(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE WHEN jsonb_typeof(value)='object' AND jsonb_typeof(value->'profile')='object'
    AND jsonb_typeof(value->'requested')='object' AND jsonb_typeof(value->'requested'->'effort')='object' THEN COALESCE(
    jsonb_typeof(value)='object'
    AND value ?& ARRAY['protocol','profile','requested']
    AND value - ARRAY['protocol','profile','requested']='{}'::jsonb
    AND value->>'protocol'='flow.claude-turn-settings.v1'
    AND octet_length(convert_to(value::text,'UTF8'))<=4096
    AND jsonb_typeof(value->'profile')='object'
    AND value->'profile' ?& ARRAY['id','runnerId','configDigest']
    AND (value->'profile') - ARRAY['id','runnerId','configDigest']='{}'::jsonb
    AND jsonb_typeof(value->'profile'->'id')='string'
    AND jsonb_typeof(value->'profile'->'runnerId')='string'
    AND value->'profile'->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND value->'profile'->>'runnerId' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND jsonb_typeof(value->'profile'->'configDigest')='string'
    AND value->'profile'->>'configDigest' ~ '^[a-f0-9]{64}$'
    AND jsonb_typeof(value->'requested')='object'
    AND value->'requested' ?& ARRAY['model','thinking','effort','speed']
    AND (value->'requested') - ARRAY['model','thinking','effort','speed']='{}'::jsonb
    AND jsonb_typeof(value->'requested'->'model')='string'
    AND value->'requested'->>'model' ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$'
    AND value->'requested'->>'thinking' IN ('disabled','adaptive')
    AND value->'requested'->>'speed' IN ('standard','fast')
    AND jsonb_typeof(value->'requested'->'effort')='object'
    AND (value->'requested'->'effort'='{"kind":"not-requested"}'::jsonb OR (
      value->'requested'->'effort' ?& ARRAY['kind','value']
      AND (value->'requested'->'effort') - ARRAY['kind','value']='{}'::jsonb
      AND value->'requested'->'effort'->>'kind'='level'
      AND value->'requested'->'effort'->>'value' IN ('low','medium','high','xhigh','max')
    )), false) ELSE false END;
$$;
ALTER TABLE flow.conversation_queue ADD COLUMN message_settings jsonb;
ALTER TABLE flow.conversation_queue ADD CONSTRAINT queue_message_settings_shape
  CHECK(message_settings IS NULL OR flow.valid_claude_message_settings(message_settings) IS TRUE);
ALTER TABLE flow.tasks ADD CONSTRAINT task_message_settings_shape CHECK (
  NOT (submission ? 'messageSettings') OR (
    flow.valid_claude_message_settings(submission->'messageSettings')
    AND submission->>'harness'='claude'
    AND NOT (submission ?| ARRAY['fixture','protocol','engineering'])
    AND submission->'executionProfile'=submission->'messageSettings'->'profile'
  ) IS TRUE
);
CREATE FUNCTION flow.reject_message_settings_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='conversation_queue' THEN
    IF NEW.message_settings IS DISTINCT FROM OLD.message_settings THEN
      RAISE EXCEPTION 'Frozen queued message settings are immutable' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.submission->'messageSettings' IS DISTINCT FROM OLD.submission->'messageSettings' THEN
    RAISE EXCEPTION 'Frozen task message settings are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER queue_message_settings_immutable BEFORE UPDATE OF message_settings ON flow.conversation_queue
  FOR EACH ROW EXECUTE FUNCTION flow.reject_message_settings_mutation();
CREATE TRIGGER task_message_settings_immutable BEFORE UPDATE OF submission ON flow.tasks
  FOR EACH ROW EXECUTE FUNCTION flow.reject_message_settings_mutation();
