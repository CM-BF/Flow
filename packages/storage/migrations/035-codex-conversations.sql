ALTER TABLE flow.conversations DROP CONSTRAINT conversations_harness_check;
ALTER TABLE flow.conversations ADD CONSTRAINT conversations_harness_check CHECK (harness IN ('claude','codex'));
