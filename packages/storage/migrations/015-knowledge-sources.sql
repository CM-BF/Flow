CREATE TABLE flow.knowledge_sources (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES flow.projects(id),
  title text NOT NULL CHECK (octet_length(title) BETWEEN 1 AND 512),
  current_version integer NOT NULL CHECK (current_version BETWEEN 1 AND 16),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX knowledge_sources_project_list ON flow.knowledge_sources(project_id,id);
CREATE TABLE flow.knowledge_versions (
  source_id uuid NOT NULL REFERENCES flow.knowledge_sources(id),
  version integer NOT NULL CHECK (version BETWEEN 1 AND 16),
  content text NOT NULL CHECK (octet_length(content)<=262144),
  content_digest text NOT NULL CHECK (content_digest=encode(sha256(convert_to(content,'UTF8')),'hex')),
  byte_length integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(source_id,version)
);
ALTER TABLE flow.knowledge_sources ADD CONSTRAINT knowledge_current_version
  FOREIGN KEY(id,current_version) REFERENCES flow.knowledge_versions(source_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE flow.knowledge_chunks (
  source_id uuid NOT NULL,
  version integer NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 68),
  start_byte integer NOT NULL CHECK (start_byte>=0),
  end_byte integer NOT NULL CHECK (end_byte>=start_byte AND end_byte<=262144),
  content text NOT NULL CHECK (octet_length(content)<=4096 AND octet_length(content)=end_byte-start_byte),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',content)) STORED,
  PRIMARY KEY(source_id,version,ordinal),
  FOREIGN KEY(source_id,version) REFERENCES flow.knowledge_versions(source_id,version)
);
CREATE INDEX knowledge_chunks_search ON flow.knowledge_chunks USING gin(search_vector);
CREATE FUNCTION flow.prevent_knowledge_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Knowledge versions are immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER knowledge_versions_immutable BEFORE UPDATE OR DELETE ON flow.knowledge_versions
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_knowledge_version_mutation();
CREATE TRIGGER knowledge_versions_no_truncate BEFORE TRUNCATE ON flow.knowledge_versions
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_knowledge_version_mutation();
