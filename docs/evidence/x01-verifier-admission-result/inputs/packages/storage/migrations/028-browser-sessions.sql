-- Random durable center identity is independent of credentials. No existing owner/runner rows change.
CREATE TABLE flow.browser_identity (
  singleton smallint PRIMARY KEY CHECK (singleton = 1),
  center_id uuid NOT NULL UNIQUE,
  owner_principal_id uuid NOT NULL UNIQUE,
  auth_epoch_hash text NOT NULL CHECK (auth_epoch_hash ~ '^[a-f0-9]{64}$')
);
CREATE TABLE flow.browser_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  auth_epoch_hash text NOT NULL CHECK (auth_epoch_hash ~ '^[a-f0-9]{64}$'),
  cookie_origin text NOT NULL CHECK (octet_length(cookie_origin) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '8 hours')
);
CREATE INDEX browser_session_expiry ON flow.browser_sessions(expires_at);
