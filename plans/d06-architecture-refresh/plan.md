# D06 固定基线架构刷新

状态：in-progress。创建/更新：2026-10-06 04:13 UTC。唯一 owner：d01_owner / gpt-6-astra ultra。

目标：将工程 dashboard 架构 tab 从旧3773基线更新为已集成固定 `8f1481df880cf5077e1ddb9a8f302fe700a7ece8` 的真实模块、数据与运行关系。用户要求工程 dashboard 增架构tab；本轮由GoalOwner经root明确授权刷新，既有五视图UI保持，架构事实不追随moving main。

## 已确认范围与取舍

- 独立tree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-refresh`，branch `codex/dashboard-architecture-refresh`，base8f。
- [正式领取](../../docs/evidence/d06/take-receipt.json) f6196ecc-b1e4-4ae2-9bd5-a2c36a6570bc v1，04:13:12.526Z。原D05已v2移出图/测试范围；只写 architecture-data.js、architecture.test.mjs、本三件套与docs/evidence/d06。
- 保持纯策展数据Interface与五视图renderer，不新建状态源/任意源码读取端点，不重启4320。原D05保留历史source，新D06由Lead登记。
- 运行边界明确用户Web/CLI、中心、独立Runner和外部SDK；数据明确产品PG+pg-boss与工程领取独立PG。
- 固定8f包含受限goals、中心conversation/typed assistant、PG plugin registry、trusted浏览器host；尚不含新版Web CHAT7cb、X03管理UI、R04并发、P03出站持久input-required、完整npm插件运行时。
- 正文/产物当前均存产品PG details.content；blob仅规划，不画已运行对象存储。assistant final、usage、验证、执行完成分开。
- FSM补全running/waiting/cancel_requested的真实completed结果与失联uncertain；uncertain经审计终结后安全retry是另一个task，不复活旧task。
- 已授权有界设计；brainstorming方法用于核范围/取舍，不重复要求用户批准。若改renderer/CSS须先新amend，当前不需要。

## TODO 与验收

- [x] D06-01：核tree/base/claim与技能，建立唯一三件套；来源固定SHA可核验。
- [ ] D06-02：刷新五图数据，所有source在固定8f存在；已集成与planned分开，关键FSM边不漏。
- [ ] D06-03：运行本模块节点/source/关系与只读HTTP测试，动态端口检查五图/双主题/窄屏，记录真实证据和clean-code。
- [ ] D06-04：提交固定候选、root独立review/修复闭环，真实dashboard聚合，交Lead集成；不自行merge main。

## 风险、验证与移交

固定图不代表最新所有分支或吞吐容量。主线继续变更时，显示旧基线是诚实边界，未来另登记更新。重用现Node24内置HTTP，无新增依赖。行为测试直接使用公开策展模块与server；源码固定gitshow核验，不用同份文字自我证明。图完整性/可读性采用动态独立预览；不改用户49922/55049/63743或工程4320。

[status](status.md) · [review](review.md) · [质量与来源](../../docs/evidence/d06/quality.md)
