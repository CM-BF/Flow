# SVC09B 固定后台完成恢复顺序

状态：completed（本固定源交付片段）。所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)。co-lead：astra_ultra_execution_lead。

目的：在固定设置后台保留原运行能力时，使已确认终态先持久清理 admission，再删除待发送记录；失败保留可恢复原件。只适配已审81b前三处native路径与18bf环境白名单，不引入插件、emitBatch或诊断producer。

- [x] SVC09B-01 精确写权与固定基底/依赖。
- [x] SVC09B-02 三处终态适配与center opt-in。
- [x] SVC09B-03 至多6项直接消费者与限定结果。
- [x] SVC09B-04 独立审查、固定组合交付。

以真实runRunner→EventOutbox→AdmissionJournal验证ACK、持久化与unlink顺序和失败重放；仅注入外部transport与精确失败点，0PG/HTTP/native/provider/个人。既有未知资源和旧失败不变。实际build/新cold/双槽/mixed/四App另归SVC09A，不属于本片通过。

独立审查已通过并交付固定source00c；实际构建/启动/双槽仍属SVC09A后继。见[review](review.md)。
