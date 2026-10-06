# O07 首合同

GoalGraphRunAdmission.execution增加claude+executionProfile引用；缺省引用仍可表示请求意图但中心明确409，不降级ordinary。GoalGraphRun.mode扩fixture|claude。新增host-only GoalGraphCapability/GoalGraphToolPort；port固定run，只readGraph(page)、readProposal(id)、commandGraph(command,key)。graph scope/quota/中心routes沿O06，不新增owner广权入口。

ExecutionProfile.configuration.access新增goal-graph-tools；empty materials/no approval。待handoff的公共字段：ClaimedTask.goalGraphRun?:GoalGraphRunReference，HarnessContext.goalGraphTools?:GoalGraphCapability；与旧node字段互斥。internalpurpose goal-graph-tools只能由graph native受理调用acceptTask；普通submit/conversation不能HTTP伪造。

019拟只扩goal_graph_runs.mode CHECK，旧17fixture行/审计不变；migrateGoalGraphRuns前进[17,19]。shared客户端沿O06既有8条HTTP即可，类型自动跟随；index/export由Lead。
