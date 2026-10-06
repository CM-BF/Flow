# COST01A Interface v1

固定合同：`packages/contracts/src/usage-readout.ts`（本文件随首次合同提交绑定）。无新依赖/迁移。

`registerUsageReadoutRoutes(app: FastifyInstance, pool: Pool): void` 挂载 `GET /api/tasks/:id/usage-readout`；复用 factory owner auth。401 缺凭据、403 runner、400 非法 ID/任何 query、404 无任务。`Cache-Control: no-store`。无请求 body、无副作用、无后台循环，Pool 生命周期仍由 factory 持有。

响应 `TaskUsageReadout`：旧 `legacy: UsageTotals` 逐值保留；`breakdown` 分开 uncached/cacheRead/cacheWrite/output/SDK estimate/provider actual，各值有完整值或 null、已知小计和已知/未知样本数。小计不是完整总额；0 样本完整值为 null。informational 永不进入 authoritative 汇总；不会把 Codex unknown 变 Claude 口径。

单次读取至多 1000 个样本（加 1 个判界），同 stream 严格前序通过一条批 SQL/lateral 取数，不按样本做网络 N+1。前序可跨 task；必须复用 usage.ts 纯贡献函数。最多返回 32 个来源组；样本越界 `hasMore=true` 且所有完整值 null，已读小计明确只是前缀。数据库读取受既有 statement_timeout 约束；这不是全库扫描容量/SLO 承诺。

版本/覆盖：既有样本没有持久 SDK version，`producerVersion=null`、`coverage=unverified`。Claude 0.3.290 reference 只说明固定生产者代码/声明的参考口径，不冒充每条历史样本的版本证据；内部 query-pipeline 外 helper 缺测，模型名不推断阶段。新源增加解释策略时只改此投影的明确静态策略，不能由任意 source string 自授权。

读取 `tasks` 仅 id、usage、harness、resume 标记，`usage_samples` 仅数值/来源/基线身份；不取 prompt、details、助手正文或 telemetry。RR 事务只给本次观察一致性，不是持久分页快照。

共享接线由 Execution Lead：contract export；`FlowClient.taskUsage(taskId, signal?) -> Promise<TaskUsageReadout>`；factory register。本 worker 不改这三处。
