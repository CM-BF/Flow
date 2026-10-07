CREATE TABLE flow.workspaces (
  id text PRIMARY KEY,
  title text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO flow.workspaces(id,title) VALUES('personal','Personal');

CREATE TABLE flow.projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES flow.workspaces(id),
  title text NOT NULL,
  revision integer NOT NULL CHECK(revision>0),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX projects_workspace_list ON flow.projects(workspace_id,id);
CREATE TABLE flow.project_revisions (
  project_id text NOT NULL REFERENCES flow.projects(id),
  revision integer NOT NULL CHECK(revision>0),
  reason text NOT NULL,
  actor text NOT NULL CHECK(actor='owner'),
  nodes jsonb NOT NULL CHECK(jsonb_typeof(nodes)='array' AND jsonb_array_length(nodes)<=200),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(project_id,revision)
);
ALTER TABLE flow.projects ADD CONSTRAINT projects_current_revision
  FOREIGN KEY(id,revision) REFERENCES flow.project_revisions(project_id,revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION flow.prevent_project_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Project revisions are immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER project_revisions_immutable BEFORE UPDATE OR DELETE ON flow.project_revisions
  FOR EACH ROW EXECUTE FUNCTION flow.prevent_project_revision_mutation();
CREATE TRIGGER project_revisions_no_truncate BEFORE TRUNCATE ON flow.project_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION flow.prevent_project_revision_mutation();

CREATE TABLE flow.project_task_bindings (
  task_id text PRIMARY KEY REFERENCES flow.tasks(id),
  project_id text NOT NULL REFERENCES flow.projects(id),
  node_id text NOT NULL,
  UNIQUE(project_id,node_id)
);
