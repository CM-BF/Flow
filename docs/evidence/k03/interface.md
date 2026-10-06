# K03 固定接口（领域实现中）

GoalInput新增可选knowledge: KnowledgeCitation[]（有序≤4、每条4KiB、总冻结8KiB、无重复exactref）；缺省与[]由领域normalize归一，避免schema transform妨碍SDK生成JSON Schema。原goal与无知识输入行为保持。

GoalDefinition.context?: GoalContextReference，只含id/contextDigest/referenceCount/rawBytes。GoalExecution.context?: GoalExecutionContextReference另含executionInputId/executionInputDigest/templateVersion。GoalNodeView仅可选knowledgeCurrent/knowledgeReferenceCount；whole-goal snapshot不展开citation或正文。完整citation仍在explicit GoalInput/history，正文仅owner detail。

已实现唯一owner GET /api/goals/:goalId/nodes/:nodeId/inputs/:version/context → GoalContextDetail，核goal/project/node/inputVersion归属；精确冻结text、freeze时与当前version，raw≤8192B且实际JSON≤65536B。registerGoalContextRoutes(server,pool)独立挂载，无需改goals/index.ts（已在v3交还）。migrateGoalContext(pool)在goals006/knowledge015/conversation018之后、任何请求/claim前执行，021编号已确认并获scope。

除normalize外以下内部函数均PoolClient，调用者持有原事务，不嵌套pool/不反向锁project：

- normalizeGoalInput(input): GoalInput：只移除空knowledge。
- freezeGoalContext(client, projectId, goalId, nodeId, inputVersion, input): 在新goal_input同TX冻结，返回small reference或undefined。
- loadGoalKnowledgeHeads(client, projectId, inputs): 一次≤128源head metadata；knowledgeCurrent(input,heads)用于现currentDeliveries递归。
- bindGoalExecutionInput(client, taskId, goalId, nodeId, inputVersion, publicPrompt): 固定context+完整业务input/dependency content编译，校验16000 UTF16/49152 UTF8，保存private input并task FK绑定；无knowledge不改变旧任务。
- goalExecutionInputForTask(client, taskId, rawPrompt): 授权claim事务内核raw/schema/完整digest/预算/归属，返回private prompt与小metadata或null；声明损坏/缺失/双goal+conversation绑定failclosed。
- copyGoalRecoveryInput(client, sourceTaskId, newTaskId, originalPrompt, recoveryPrompt): 同冻结context，以既有recoverySubmission新prompt重新编译/新digest；不造goal_execution，不恢复deliveryCurrent，不隐式resume。

contextDigest只覆盖有序citation+精确冻结text；executionInputDigest单独包括完整中心输入/templateVersion/publicPrompt/privatecompiled（不声称等于adapter追加material路径后的全部SDK输入）。新私有表goal_contexts按(goal,node,inputVersion)唯一，goal_execution_inputs按id不可变，tasks.goal_input_id独立immutable FK与conversation_input_id互斥。公共task.submission.prompt继续无私有知识正文；fixture产物会合法echo执行输入，所以公开字段无泄露断言在执行前，执行后不得把合法artifact引用知识判成中心投影泄漏。

source版本变化（即便digest同）使知识stale，旧cite也stale；source heads读与input投影同快照。拒新execute/accept，accepted引用保留但current=false，失效沿真实dependsOn传播，独立节点不误伤。运行中不换字节/不取消/不自动重跑。

runnerCommand在commandInTransaction首次分支内核owner refs exact顺序不变；增删换序拒绝，knowledge-bearing execute首片拒绝runner。原无refs命令与老key ACK重放不变，读input只metadata，不新增knowledge grant。

当前小片段：021+migrate/register、define-input冻结、detail、私有claim投影与recovery copy helper已有实现和5项真实/纯helper检查。execute/stale/runner-command门禁与reconciliation调用已实现，领域矩阵15项+旧版本定向1项通过；runners接缝已在完整O06/O07固定基线上实现并通过实际claim与原runtime验证，prod index/client归共享owner。共享hook未接不称端到端交付。K02旧reconciliation已明确停写，交接由Mika原子协调。

private claim接线：从goal-context/index.ts导入goalExecutionInputForTask，在原runner授权与task锁事务中与K02同类helper一起读取；返回非null时只替换assignment.task.prompt副本，可将context放单独goalContext可选字段。必须先migrate021，不能缺表回退。helper会拒双绑定；生产接线与真实runner用例尚未执行。

当前基线组合依赖：c22412b5 runners.ts无条件引用goal_graph_runs、goal-graph-tools execution profile purpose与goalGraphRun契约；a6基线缺这些O06依赖。共享文件尚未消费/改写，等待Lead受控完整基线，禁止缺表fallback。

最终接口21d2e05eb571e44883589eb38bff6b5a4b2eaeb7：shared115b/acfd已完整无冲突合入；claim不新增goalContext字段，只替换私有prompt，owner执行history.context提供metadata。此前缺组合依赖已解除。生产migrateGoalContext必须在scheduler/请求/claim/recovery可用前完成，registerGoalContextRoutes需在ready/listen前执行。
