# O15 完整输入提案与一次确认

状态：in-progress。创建/更新：2026-10-06。唯一所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)；co-lead：Execution Lead。

用户结果：规划提案包含每个新增节点的实际需求、约束、验收和固定材料引用；用户一次确认后中心按已授权依赖继续推进。图标题不替代输入，旧结果在输入修订后仍可追溯但不冒称当前交付。沿原O01/M02，不新增大task。

已批准设计见[设计](../../docs/evidence/o15/approved-design.md)与[Interface](../../docs/evidence/o15/interface.md)；统一引用[模块化规则](../../AGENTS.md#modular-design)。原O05图提案、O01输入版本、K03材料冻结和O14授权为唯一领域实现，新模块仅原子组合并保存确认收据。旧graph grant无新增protocol时不获得完整输入提案能力；现时权限先于幂等恢复，业务CAS只在new-command分支。

- [x] O15-01 固定DTO/Interface、独立scope与权威状态。
- [x] O15-02 实现显式提案能力及原子确认/唯一收据。
- [x] O15-03 验证局部0模型两节点公开旅程、失败/恢复与旧直接消费者。
- [x] O15-04 固定证据，独立review后主线接收及范围释放。

限制：本片只新增节点；B输入修订由既有owner命令完成，不声称模型自主修订。SDK query只注入，真实自然语言规划/模型预算仍父计划后继。共享client/export/index由F01负责。031由Lead预留；不改旧DDL。资源窗口不足时先源码/有界纯检查，禁止安装/大拷贝；PG须Lead/Web协调及实测余量满足1GiB+自身新增峰值，不用96MiB计划值直接启动。
