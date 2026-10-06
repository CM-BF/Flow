# O09 最小 Interface

合同 packages/contracts/src/goal-native-executions.ts：goalNativeExecutionSchema / GoalNativeExecution / GoalNativeExecutionResult。旧GoalCommand未改。

Owner `POST /api/goals/:id/native-executions`，Bearer owner，Idempotency-Key必填。body严格字段nodeId、expectedInputVersion、dependencies、previousExecutionId、reason、executionProfile{id,runnerId,configDigest}；禁止harness/prompt/fixture/access任意设置。成功201，返回GoalCommandResult + executionProfile；同key原receipt恢复，不重复受理；同key异input409。没有新读接口：现goal snapshot/history/task/artifact读接口继续使用，profile pin也存在命令receipt与task submission。

导出 registerGoalNativeExecutionRoutes(app:FastifyInstance,pool:Pool,boss:PgBoss):void；无需新迁移。内部 admitGoalNativeExecution(pool,boss,goalId,input,key) 返回Promise<GoalNativeExecutionResult>。授权由现生产owner hook覆盖；模块测试用真实createServer追加register（有hasRoute guard），共享Lead生产挂载。

400严格schema/key，401凭据，409未知/撤销或不匹配profile、非configured-readonly普通purpose、输入/依赖/前次执行不满足。现owner认证未给runner新特权；旧GoalToolPort.execute继续fixture，native accept-delivery在runner grant路径403。profile声明不是provider可用证明；真实SDK调用费用未授权。

复用同TX execute深模块/acceptTask/K03：只有当前定义+精确已接受依赖+前次succeeded/failed/cancelled可新授权，uncertain拒绝；profile固定到task。机械flow.text独立核对不等业务语义接受；owner原accept-delivery+reason是显式声明，不新造自动语义验收器。
