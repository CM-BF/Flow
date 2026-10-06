# O13 — 同一入口的连续目标旅程

状态 in-progress；创建/更新 2026-10-06。唯一父 [FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)，追溯 O01-05/O12-05/M02；co-lead Execution Lead。

在选定项目中保存自然语言原文、约束、验收条件，受理后沿同一 GoalSession 显式提交受限规划与只读文本执行，查看固定产物及解释，并交由独立 owner 接受或保留交付。本片先交 0query 组合，不宣称真实模型规划或真实 UI 连续验收。

复用 O07/O09/O11/O12 的中心权限、调度、runner/query/outbox 和现有 Intent 状态机。[Interface](../../docs/evidence/o13/interface.md) 定义新增入口与轻读合同。遵守[模块化规则](../../AGENTS.md#modular-design)。不从图标题自动生成 child 输入，不把机械校验通过当业务接受；真实模型新预算另定，O08/O10 封存不动。

- [x] **O13-01** 原子领取、固定 DTO/Interface 与唯一三件套。
- [x] **O13-02** 自然语言 intake 恢复接缝、原 GoalSession 新命令和规划轻读。
- [x] **O13-03** 0query 公开 HTTP/独立 PG 与注入 SDK 连续旅程、未知/重启/直接兼容检查。
- [x] **O13-04** 固定证据与 clean-code，独立审查、主线接收及领取释放。
- [ ] **O13-05** 后继真实规划与 child 独立预算、真实 UI 连续验收；不在本片 0query 交付范围。

范围固定 13 literal，见证据 claim.json。F01 提供薄 client/export，不改共享入口与锁文件。只验证本 Module 和直接消费者，动态端口、随机专库、有限日志、自有资源清理。无新 migration/依赖/模型调用。架构图接收登记由 Execution Lead 维护。
