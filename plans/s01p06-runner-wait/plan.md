# S01P06 Runner 等待订阅有界

状态：in-progress；创建/更新：2026-10-06。所属大task：[FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)；co-lead：mika。原需求追溯 S01-06，非第三层任务。

目标：长驻 attempt 跨多轮 polling 时，等待不再为同一 pending promise 反复添加完成 reaction；保持单 admission loop 与及时补槽。

已确认：Mika 派工采用内部 AttemptWakeup；不改领取、journal、原 request deadline、fatal/recovery/native unknown/stop-drain。0 provider/PG/128负载；不以有限虚拟ticks推断小时RSS或吞吐。

## Interface 与验证

见 [interface.md](../../docs/evidence/s01p06/interface.md)。本片仅四个runner源码/测试及自有证据/计划。依赖沿原声明复用已安装固定版本，不安装、不新造package alias。setup新增physical≤256MiB，并保留≥1GiB共享空间。

## TODO

- [x] S01P06-01：固定输入、六scope与最小Interface。
- [x] S01P06-02：有限counter红绿与内部唤醒实现。
- [x] S01P06-03：真实loopback及时补槽及runner/shutdown/capacity直接消费者、局部strict。
- [ ] S01P06-04：固定source/raw、独立review与main接收。

风险：完成早于wait不得丢通知；多个完成仅需一次通知；abort/close清理timer/listener；订阅在journal.complete和active.delete之后唤醒。原4项PG未选，不变更已有断言。
