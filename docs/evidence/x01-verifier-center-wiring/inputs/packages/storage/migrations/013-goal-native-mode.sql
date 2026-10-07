ALTER TABLE flow.goal_tool_runs DROP CONSTRAINT goal_tool_runs_mode_check;
ALTER TABLE flow.goal_tool_runs ADD CONSTRAINT goal_tool_runs_mode_check CHECK(mode IN ('fixture','claude'));
