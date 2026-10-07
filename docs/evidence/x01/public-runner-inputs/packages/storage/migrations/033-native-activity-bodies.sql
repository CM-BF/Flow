-- Material identity is immutable. Only receipt counters and sealing progress change.
CREATE TABLE flow.native_activity_bodies (
  activity_id text PRIMARY KEY REFERENCES flow.native_activities(id),
  task_id text NOT NULL REFERENCES flow.tasks(id),
  attempt_id text NOT NULL REFERENCES flow.attempts(id),
  native_session_id text NOT NULL,
  bytes integer NOT NULL CHECK (bytes BETWEEN 0 AND 8388608),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  media_type text NOT NULL CHECK (media_type IN ('application/json','text/plain')),
  received_bytes integer NOT NULL DEFAULT 0 CHECK (received_bytes BETWEEN 0 AND bytes),
  received_chunks integer NOT NULL DEFAULT 0 CHECK (received_chunks BETWEEN 0 AND 128),
  complete boolean NOT NULL DEFAULT false,
  CHECK (NOT complete OR received_bytes=bytes)
);
CREATE INDEX native_activity_bodies_attempt ON flow.native_activity_bodies(attempt_id);
CREATE TABLE flow.native_activity_body_chunks (
  activity_id text NOT NULL REFERENCES flow.native_activity_bodies(activity_id),
  chunk_index integer NOT NULL CHECK (chunk_index BETWEEN 0 AND 127),
  byte_offset integer NOT NULL CHECK (byte_offset BETWEEN 0 AND 8388607),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 65536),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content bytea NOT NULL CHECK (octet_length(content)=bytes),
  PRIMARY KEY(activity_id,chunk_index)
);
