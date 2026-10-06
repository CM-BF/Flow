# D06 固定基线架构刷新

状态：in-progress。更新：2026-10-06T06:34:16Z。唯一 owner：workspace_panels_owner / gpt-6-astra ultra。

目标：沿既有五视图，将架构源码事实刷新到固定 main `115b0dbdfa02db5483f9e9699852682ce699633c`，清楚区分代码已集成、仅独立模块、后继计划与真实服务。本轮没有产品运行改动。

## 范围和已确认方案

新树 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-context`，branch `codex/dashboard-architecture-context`，base 115b。[正式领取](../../docs/evidence/d06/context/take-receipt.json) claim981d7c08-a145-4846-b456-496fe0ce5c83 v1，06:26:57.559Z committed，06:27:16.818Z owner核live active。旧e5b2 v2已释放且旧owner停写；唯一source迁移由Lead完成，本树不写registry。

四literal scopes：`apps/execution-dashboard/public/architecture-data.js`、`apps/execution-dashboard/test/architecture.test.mjs`、`plans/d06-architecture-refresh`、`docs/evidence/d06`。renderer architecture.js/CSS/index/server/shared/根依赖不改。证据下新可执行检查脚本属于实现target和scope。

固定源码核Queue Web真实控件、K01/K02、O06/O07、X04；X04只包校验落盘，不能写成npm安装/启用。renderer747已含模块但App未接，CHAT05/06不在基线则planned。当前图不是实时运行拓扑；个人服务历史fb906与本115b快照分别描述，不变更任何服务。使用同一baseline生成source链接，planned节点也必须有115b可验证来源。

## TODO

- [x] D06-01：新树、正式claim、技能、旧canonical原样归档与唯一source迁移交接。
- [x] D06-02：固定115b源码核验，更新五视图数据与精确来源。
- [x] D06-03：局部Node/source检查与动态预览，双主题390px、键盘与减少动画，记录clean-code。
- [ ] D06-04：固定实现独立review、唯一聚合与Lead集成交接；main/部署分别记录。

## 验证与历史

仅现有图检查和新事实直接校验；无模型/产品DB/全库/真实服务重启。架构影响为固定策展数据，没有新增运行Interface。当前review NOT_STARTED，不继承历史approval。

[旧eb轮索引](../../docs/evidence/d06/context/history.md)保留原三件套txt及历史source路径语义；其5ec目标曾批准并已含本base，不代表本轮批准。原D06-01..04稳定ID沿用。source登记由manager/Lead单点迁移。

[status](status.md) · [review](review.md) · [本轮证据](../../docs/evidence/d06/context/README.md)

固定实现 `ebad46356efec7bd86f8aadd9d765bb6b6b190af` 已交root独审；作者10局部检查与五图browser通过，sourcehash精确绑定，[验证](../../docs/evidence/d06/context/validation.md)。D06-04仍待独立review/最终聚合与main，未提前勾选。
