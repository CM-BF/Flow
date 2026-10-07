# O16 连续目标真实验收准备

ID：O16；状态：in-progress；创建/更新：2026-10-06 18:17:35 UTC。
所属大task：[FLOW-001](../../../plan-status-review/plans/flow-001-architecture/plan.md)；co-lead：Execution Lead。追溯 O01-05/O12-05/M02，不另立大任务。

目标是从一个自然语言需求，经真实受限规划、owner 看过实际完整输入后确认、中心自动推进两项依赖任务，得到可独立判断的产物和同入口事实解释。当前仅授权零模型准备与接口实现，真实 plan 和 confirmation/children 分两段新许可；最多三次 query / SDK声明预算0.40USD只是候选，O08/O10旧预算封存。

- [x] **O16-01** 独立稀疏树、fresh原子claim、固定职责/Interface与已审输入。
- [x] **O16-02** 有限两段许可/三槽持久reservation、unknown不可复投与观测边界。
- [ ] **O16-03** 原生产模块的public journey组合、受管资源checkpoint与独立语义输入。
- [ ] **O16-04** 零query纯检查及获串行窗口后的实际PG/MCP注入旅程，准确保存资源/原始失败。
- [ ] **O16-05** 固定manifest、唯一独立review、按批准范围交付。
- [ ] **O16-06** 单独新许可下真实plan；实际proposal后另许可确认/children，并由独立actor验收语义。当前未授权/未运行。

[设计](../../docs/evidence/o16/approved-proposal.md)与[Interface](../../docs/evidence/o16/interface.md)是本片范围说明。严格沿[根模块规则](../../AGENTS.md#modular-design)：原runner/SDK adapter/center scan单一权威，实验只拥有许可、私有资源和证据生命周期。O12没有confirmation command、中心没有独立artifact rejection reason字段；此实验不补第二领域，明确留后继。

仅可写 experiments/continuous-goal-acceptance、plans/o16-continuous-goal-acceptance、docs/evidence/o16。实际base8bd02cc3b9ec7afe5fec461e4d8ee05798e5d974；proposal输入0132仅此前只读观察。所有源码/SQL/入口闭包将按新base重新固定，不能继承旧O08/O10 source guard。无产品改动、无provider/auth/个人服务、无新安装。PG需Lead窗口，源码/已安装依赖内小检查可独立推进。

2026-10-07T08:17:45Z 续接：由原owner沿原claim验当前主线，先固定P02集成后精确base与动态输入闭包，再新的零模型公共旅程；旧26准备绿/FAIL/KEEP不重写。参见[current-main-resumption](../../docs/evidence/o16/current-main-resumption.md)。
