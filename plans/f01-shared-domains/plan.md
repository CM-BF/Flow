# F01 公共领域接入

状态：in-progress。Owner：Execution Lead / gpt-6-astra ultra。Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation`，branch `codex/m2-shared-foundation`，base `873738d9eb998c10bc71721d9b325fcc76ecd7b5`。

为独立G01/P02 owner解除共享入口依赖；领域合同由owner写，公共export/client/CLI/注册/usage政策由Lead统一。沿用find-skills本地优先，实际应用codebase-design/clean-code/tdd，保持小接口和真实消费者验证；不修改Web owner目录。

- [x] **F01-01** P02领域导出、A2A任务配置约束与集中harness/usage政策，不将未知来源误计为Claude。
- [x] **F01-02** 共享client、outbox续接序号和heartbeat剩余租期；局部行为检查。
- [x] **F01-03** G01领域合同/中心入口/client/最小CLI与真实消费者检查。
- [x] **F01-04** P02中心/独立runtime接线、差异review与集成；当前不凭只有接口声称远端调度完成。

status唯一事实源；review绑定实现target。G01迁移004，P02迁移005，互不争写；远端绝不因ACK丢失自动重发。一般native runner的远端时钟可靠性另R03验证，不将P02新剩余租期字段说成旧runtime已修。

- [x] **F01-05** O01中心注册/client/CLI薄接线与真实消费者验证、固定target独立review、集成。

- [ ] **F01-06** CHAT public合同/client/中心挂载与typed final接缝，先接口独立批准，三端真实旅程另验。

- [ ] **F01-07** X02 registry生产挂载、公用client/CLI，验证持久登记与实际不可用状态；安装/加载仍留X01后继。
