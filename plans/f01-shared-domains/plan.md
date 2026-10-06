# F01 公共领域接入

状态：in-progress。Owner：Execution Lead / gpt-6-astra ultra。Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation`，branch `codex/m2-shared-foundation`，base `873738d9eb998c10bc71721d9b325fcc76ecd7b5`。

为独立G01/P02 owner解除共享入口依赖；领域合同由owner写，公共export/client/CLI/注册/usage政策由Lead统一。沿用find-skills本地优先，实际应用codebase-design/clean-code/tdd，保持小接口和真实消费者验证；不修改Web owner目录。

- [x] **F01-01** P02领域导出、A2A任务配置约束与集中harness/usage政策，不将未知来源误计为Claude。
- [x] **F01-02** 共享client、outbox续接序号和heartbeat剩余租期；局部行为检查。
- [x] **F01-03** G01领域合同/中心入口/client/最小CLI与真实消费者检查。
- [x] **F01-04** P02中心/独立runtime接线、差异review与集成；当前不凭只有接口声称远端调度完成。

status唯一事实源；review绑定实现target。G01迁移004，P02迁移005，互不争写；远端绝不因ACK丢失自动重发。一般native runner的远端时钟可靠性另R03验证，不将P02新剩余租期字段说成旧runtime已修。

- [x] **F01-05** O01中心注册/client/CLI薄接线与真实消费者验证、固定target独立review、集成。

- [x] **F01-06** CHAT public合同/client/中心挂载与typed final接缝，先接口独立批准，三端真实旅程另验。

- [x] **F01-07** X02 registry生产挂载、公用client/CLI，验证持久登记与实际不可用状态；安装/加载仍留X01后继。

- [x] **F01-08** CHAT03执行配置公共client/export/挂载与局部消费者验证，目录配置与实际在线/生效事实分开。

- [x] **F01-09** CHAT04持久队列client、生产串行恢复扫描，与兼容Web reader成套接收。
- [x] **F01-10** O03受限goal工具公共client/生产挂载；native权限另O04纵向owner。

- [x] **F01-11** O05版本化图提案公共client/导出与生产接线，保持owner授权，不冒认模型自动拆解。

- [x] **F01-12** SVC02维护公共查询/命令与生产接线，观察/receipt不当停止许可。
- [x] **F01-13** K01版本原文/引用/词法查询公共client与生产接线，原文版本不被最新值替换。

- [x] F01-14：O06受限目标拆分公共client与017生产接线，保持fixture/原生边界。
- [x] F01-15：独立新预算下真实Web暂停/运行时排队/核成本后继续；前置未齐不调用模型。

- [x] F01-16：K02上下文公共detail与018生产接入，组合O07/019和兼容Web；局部检查后独立review与集成。

- [ ] F01-17：CHAT05公共轻活动读取与显式详情client、020生产挂载；保持owner鉴权/正文懒取/取消后unknown。
