CREATE TABLE flow.goal_graph_proposals (
  id text PRIMARY KEY,
  goal_id text NOT NULL REFERENCES flow.goals(id),
  project_id text NOT NULL REFERENCES flow.projects(id),
  base_revision integer NOT NULL CHECK(base_revision>0),
  goal_digest text NOT NULL CHECK(goal_digest ~ '^[a-f0-9]{64}$'),
  proposal_digest text NOT NULL CHECK(proposal_digest ~ '^[a-f0-9]{64}$'),
  input jsonb NOT NULL,
  source text NOT NULL CHECK(source='owner-submission'),
  node_count integer NOT NULL CHECK(node_count BETWEEN 1 AND 16),
  edge_count integer NOT NULL CHECK(edge_count BETWEEN 0 AND 128),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(project_id,base_revision) REFERENCES flow.project_revisions(project_id,revision)
);
CREATE INDEX goal_graph_proposals_page ON flow.goal_graph_proposals(goal_id,id);
CREATE TABLE flow.goal_graph_applications (
  proposal_id text PRIMARY KEY REFERENCES flow.goal_graph_proposals(id),
  project_id text NOT NULL REFERENCES flow.projects(id),
  from_revision integer NOT NULL, to_revision integer NOT NULL CHECK(to_revision>from_revision),
  node_ids jsonb NOT NULL, actor text NOT NULL CHECK(actor='owner'),
  applied_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(project_id,from_revision) REFERENCES flow.project_revisions(project_id,revision),
  FOREIGN KEY(project_id,to_revision) REFERENCES flow.project_revisions(project_id,revision)
);
CREATE TRIGGER goal_graph_proposals_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_graph_proposals
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
CREATE TRIGGER goal_graph_applications_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_graph_applications
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
