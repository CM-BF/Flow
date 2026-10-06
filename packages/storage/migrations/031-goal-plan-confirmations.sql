CREATE TABLE flow.goal_plan_confirmations (
  proposal_id text PRIMARY KEY REFERENCES flow.goal_graph_applications(proposal_id),
  goal_id text NOT NULL REFERENCES flow.goals(id), project_id text NOT NULL REFERENCES flow.projects(id),
  progression_id text NOT NULL UNIQUE REFERENCES flow.goal_progressions(id),
  confirmation jsonb NOT NULL, confirmation_digest text NOT NULL CHECK(confirmation_digest ~ '^[a-f0-9]{64}$'),
  receipt jsonb NOT NULL, confirmed_at timestamptz(3) NOT NULL,
  CHECK((confirmation->>'protocol') IS NOT DISTINCT FROM 'flow.goal-plan-confirmation.v1'),
  CHECK(octet_length(confirmation::text)<=65536 AND octet_length(receipt::text)<=65536),
  CHECK((receipt->>'proposalId') IS NOT DISTINCT FROM proposal_id),
  CHECK((receipt->>'goalId') IS NOT DISTINCT FROM goal_id),
  CHECK((receipt->>'projectId') IS NOT DISTINCT FROM project_id),
  CHECK((receipt->>'progressionId') IS NOT DISTINCT FROM progression_id),
  CHECK((receipt->>'confirmationDigest') IS NOT DISTINCT FROM confirmation_digest)
);
CREATE FUNCTION flow.validate_goal_plan_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM flow.goal_graph_proposals p JOIN flow.goal_graph_applications a ON a.proposal_id=p.id
      JOIN flow.goal_progressions g ON g.id=NEW.progression_id
    WHERE p.id=NEW.proposal_id AND p.goal_id=NEW.goal_id AND p.project_id=NEW.project_id
      AND g.goal_id=NEW.goal_id AND g.project_id=NEW.project_id
      AND (g.manifest->>'projectRevision')::integer=a.to_revision
      AND p.proposal_digest=NEW.confirmation->>'proposalDigest'
      AND p.proposal_digest=NEW.receipt->>'proposalDigest'
      AND g.authorization_digest=NEW.receipt->>'authorizationDigest'
      AND p.input->'inputProposal'->>'protocol'='flow.goal-input-proposal.v1'
  ) THEN RAISE EXCEPTION 'Invalid goal plan confirmation association' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goal_plan_confirmation_association BEFORE INSERT ON flow.goal_plan_confirmations
  FOR EACH ROW EXECUTE FUNCTION flow.validate_goal_plan_confirmation();
CREATE TRIGGER goal_plan_confirmation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON flow.goal_plan_confirmations
  FOR EACH STATEMENT EXECUTE FUNCTION flow.reject_goal_history_mutation();
