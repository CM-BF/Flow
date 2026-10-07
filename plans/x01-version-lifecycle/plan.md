# X01-VERSION-LIFECYCLE01：固定包装版本升级与回滚

所属大task：[X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)。co-lead Mika；owner db_transaction_owner / gpt-6-astra。状态 in-progress；2026-10-07。

目标：真实公共管理与runner路径验证同一 semver@7.8.5 的 Flow 包装 A1.0.0 → B1.0.1 → select A 回滚。不是 npm 上游升级。复用现单一服务、PluginDatabaseFixture/OPS14；不改FSM/API。

- [x] X01LIFE-01 固定材料、真实 phase gate 与有限准备输入。
- [x] X01LIFE-02 专用单case源码、focused types 与 collect，独立只读准备审。
- [x] X01LIFE-03 新独立PG窗口实际A/B/C与资源闭合；未OPEN不运行。
- [ ] X01LIFE-04 固定实际结果独审、主线接收与完整边界登记。

A由生产 runRunner 执行，transport委托真实pluginRunner，load ACK返回前受控Promise gate暂停。已持有attempt且load授权有真实DB回执；尚未invoke，不称工具函数已运行中。切B时注册增revision，select清空config/grants，显式configure、grant、enable。B完成后恢复A，A必须继续使用原材料/配置/pin。回滚选择A后重复配置授权启用，新C绑定A。保存A事件前缀，后续只可追加；旧binding逐字不变。禁用挡新admit，撤tool挡新的phase授权；原大task工具实际执行中版本切换缺口仍开放，不以本片勾全X01-04。

预算：本地20min段11:12:13Z–11:32:13Z；每child60s累计120s，TMP16MiB/raw512KiB/source+meta2MiB，0PG/provider/Chrome/install。拟PG单case180s=110work+60cleanup+10收尾，1DB、单runner且中心capacity2/本地maxConcurrentAttempts2，至多4task、两材料、HTTP≤256、TMP32MiB、raw1MiB、DB/WAL128MiB；门槛沿最新组合至少5,334,630,400B，实际另调度。未知KEEP，不自动重跑或换key。

遵守[模块规则](../../AGENTS.md#modular-design)。本片只有测试/证据，不新增产品架构；生命周期依赖保持单一权威。
