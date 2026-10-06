# O12 — 同一目标会话的轻读与显式命令

编号 O12；2026-10-06 创建/更新；状态 in-progress。
所属 [FLOW-001](../flow-001-architecture/plan.md)，追溯 O01-05/M02；co-lead Execution Lead。

在已有目标上提供 headless 可复用 controller：分页计划、选中节点实时状态、历史解释轻引用、固定正文显式展开，以及持久未决命令。中心仍拥有版本、授权、调度与交付判定；客户端不自动执行、接受交付或生成解释。

遵守[模块化规则](../../AGENTS.md#modular-design)。[接口与边界](../../docs/evidence/o12/interface.md)是本片设计，已有 goal/project/decision/cancel 规则保持原样。仅添加 immutable goal_explanations 查询，无 migration/第二日志。

- [ ] O12-01 固定接口、历史解释轻分页和固定正文公开读口。
- [ ] O12-02 单目标 controller：有界观察/显式详情/固定命令与未知回执恢复。
- [ ] O12-03 真实 HTTP/PG 双客户端旅程、超过50解释、冲突/ACK丢失/取消/资源与字节证据。
- [ ] O12-04 独立审查、必要共享接线和 main 接收。
- [ ] O12-05 后继完整自然语言与实际UI连续目标验收（本片不承诺）。

范围是已领取五个 literal scopes；shared package export/client signals/根锁由 Lead。0 provider、随机专库、动态端口；不触个人服务，不添加依赖。只验证本模块及直接 O11 消费者；测试从公开接口检验行为，错误和失败原始输出保留。

风险：本地 intent store 由宿主提供持久实现并独占单实例；断连不能宣称远端停工。历史解释只陈述过去，不代表当前输入有效。重试必须原 key/body，未知不能由读口推断成功。分页 RR 是单请求一致读取，不是持久快照；解释通过 immutable row + high-watermark 延续身份。
