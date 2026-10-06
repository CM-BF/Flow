# O14 持久目标推进

状态：completed（本模块）。所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)；co-lead：Execution Lead。2026-10-06。

用户结果：在用户一次明确批准有限节点、现有实际输入和预算后，中心持续推进依赖工作；关闭客户端仍继续。机械检查与用户语义接受分开。沿原 O01-05/O12-05/M02，不另建大task。

已确认设计见 [Interface](../../docs/evidence/o14/interface.md)，规则引用 [模块化与复用](../../AGENTS.md#modular-design)。最多20个节点；旧 GoalIntent/手动执行与接受保持；无新timer、provider预算或个人服务操作。用原任务事务、队列、runner、outbox以及中心现有scan生命周期。030由Lead专用预留，029归X01。

- [x] O14-01 固定授权合同与复用 Interface、精确scope。
- [x] O14-02 实现不可变授权/链接、单次推进与共用依赖资格。
- [x] O14-03 局部真实 HTTP/随机PG、两节点注入SDK及旧直接消费者验证。
- [x] O14-04 独立review、主线集成与产品范围释放。

资源：本树稀疏保留全source/test/rules/plans与自有证据；源码/metadata新增不超过20MB。无新install/copy；复用锁定第三方，workspace link只向本树。PG前fresh>=1GiB余量并与Lead排窗口。真实模型规划/child预算及UI授权入口仍是父计划后继。
