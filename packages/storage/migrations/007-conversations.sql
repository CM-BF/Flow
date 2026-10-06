CREATE TABLE flow.conversations (
  id text PRIMARY KEY, title text NOT NULL, harness text NOT NULL CHECK(harness='claude'),
  requested jsonb NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE flow.conversation_turns (
  id text PRIMARY KEY, conversation_id text NOT NULL REFERENCES flow.conversations(id),
  number integer NOT NULL CHECK(number>0), task_id text NOT NULL UNIQUE REFERENCES flow.tasks(id),
  user_text text NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(conversation_id,number)
);
CREATE FUNCTION flow.reject_conversation_turn_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Conversation turns are immutable' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER conversation_turns_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.conversation_turns
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_conversation_turn_mutation();
