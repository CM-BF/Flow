# K03 固定接口（领域实现中）

GoalInput新增可选knowledge: KnowledgeCitation[]（有序≤4、每条4KiB、总冻结8KiB、无重复exactref）；缺省与[]由领域normalize归一，避免schema transform妨碍SDK生成JSON Schema。原goal与无知识输入行为保持。

GoalDefinition.context?: GoalContextReference，只含id/contextDigest/referenceCount/rawBytes。GoalExecution.context?: GoalExecutionContextReference另含executionInputId/executionInputDigest/templateVersion。GoalNodeView仅可选knowledgeCurrent/knowledgeReferenceCount；whole-goal snapshot不展开citation或正文。完整citation仍在explicit GoalInput/history，正文仅owner detail。

计划唯一owner GET /api/goals/:goalId/nodes/:nodeId/inputs/:version/context → GoalContextDetail，核goal/project/node/inputVersion归属；精确冻结text、freeze时与当前version，raw≤8192B且实际JSON≤65536B。registerGoalContextRoutes(server,pool)独立挂载，无需改goals/index.ts，建议交还该scope。migrateGoalContext(pool)在goals006/knowledge015/conversation018之后、任何请求/claim前执行，021编号已确认并获scope。

以下内部函数均PoolClient，调用者持有原事务，不嵌套pool/不反向锁project：

- normalizeGoalInput(input): GoalInput：只移除空knowledge。
- freezeGoalContext(client, projectId, goalId, nodeId, inputVersion, input): 在新goal_input同TX冻结，返回small reference或undefined。
- loadGoalKnowledgeHeads(client, projectId): 一次≤128源head metadata；knowledgeCurrent(input,heads)用于现currentDeliveries递归。
- bindGoalExecutionInput(client, taskId, goalId, nodeId, inputVersion, publicPrompt, executionContext): 固定context+完整业务input/dependency content编译，校验16000 UTF16/49152 UTF8，保存private input并task FK绑定；无knowledge不改变旧任务。
- goalExecutionInputForTask(client, taskId, rawPrompt): 授权claim事务内核raw/schema/完整digest/预算/归属，返回private prompt与小metadata或null；声明损坏/缺失/双goal+conversation绑定failclosed。
- copyGoalRecoveryInput(client, sourceTaskId, newTaskId, originalPrompt, recoveryPrompt): 同冻结context，以既有recoverySubmission新prompt重新编译/新digest；不造goal_execution，不恢复deliveryCurrent，不隐式resume。

contextDigest只覆盖有序citation+精确冻结text；executionInputDigest单独包括完整中心输入/templateVersion/publicPrompt/privatecompiled（不声称等于adapter追加material路径后的全部SDK输入）。新私有表goal_contexts按(goal,node,inputVersion)唯一，goal_execution_inputs按id不可变，tasks.goal_input_id独立immutable FK与conversation_input_id互斥。公共task.submission.prompt继续无私有知识正文；fixture产物会合法echo执行输入，所以公开字段无泄露断言在执行前，执行后不得把合法artifact引用知识判成中心投影泄漏。

source版本变化（即便digest同）使知识stale，旧cite也stale；source heads读与input投影同快照。拒新execute/accept，accepted引用保留但current=false，失效沿真实dependsOn传播，独立节点不误伤。运行中不换字节/不取消/不自动重跑。

runnerCommand在commandInTransaction首次分支内核owner refs exact顺序不变；增删换序拒绝，knowledge-bearing execute首片拒绝runner。原无refs命令与老key ACK重放不变，读input只metadata，不新增knowledge grant。

当前接线状态：commands与021已获v2范围可实现；runners/reconciliation/prod index/client仍待移交。共享hook未接不称端到端交付。K02旧reconciliation已明确停写，交接由Mika原子协调。
