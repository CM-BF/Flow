ALTER TABLE flow.assistant_messages DROP CONSTRAINT assistant_messages_source_check;
ALTER TABLE flow.assistant_messages ADD CONSTRAINT assistant_messages_source_check
  CHECK (source IN ('claude.sdk.result', 'codex.app-server.agent-message'));
ALTER TABLE flow.assistant_messages DROP CONSTRAINT assistant_messages_native_session_id_source_message_id_key;
ALTER TABLE flow.assistant_messages ADD CONSTRAINT assistant_messages_source_identity_key
  UNIQUE(source, native_session_id, source_message_id);
ALTER TABLE flow.assistant_messages ADD COLUMN native_source_identity jsonb;
ALTER TABLE flow.assistant_messages ADD CONSTRAINT assistant_messages_native_source_identity_check CHECK (
  (source = 'claude.sdk.result' AND native_source_identity IS NULL)
  OR (source = 'codex.app-server.agent-message' AND native_source_identity IS NOT NULL
    AND jsonb_typeof(native_source_identity) = 'object'
    AND native_source_identity ?& ARRAY['turnId', 'itemId']
    AND native_source_identity - 'turnId' - 'itemId' = '{}'::jsonb
    AND jsonb_typeof(native_source_identity->'turnId') = 'string'
    AND jsonb_typeof(native_source_identity->'itemId') = 'string'
    AND octet_length(native_source_identity->>'turnId') BETWEEN 1 AND 128
    AND octet_length(native_source_identity->>'itemId') BETWEEN 1 AND 128
    AND octet_length(native_session_id) BETWEEN 1 AND 128
    AND source_message_id ~ '^[a-f0-9]{64}$')
);
-- Final admission must not scan unrelated artifact/detail bodies for its bounded session evidence.
CREATE INDEX details_native_session_evidence ON flow.details(task_id, attempt_id) WHERE kind = 'session';
