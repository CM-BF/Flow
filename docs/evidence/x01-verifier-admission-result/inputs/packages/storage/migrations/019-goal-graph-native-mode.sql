ALTER TABLE flow.goal_graph_runs DROP CONSTRAINT goal_graph_runs_mode_check;
ALTER TABLE flow.goal_graph_runs ADD CONSTRAINT goal_graph_runs_mode_check CHECK(mode IN ('fixture','claude'));
