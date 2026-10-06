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

- [x] F01-17：CHAT05公共轻活动读取与显式详情client、020生产挂载；保持owner鉴权/正文懒取/取消后unknown。

- [x] F01-18：X05包下载公共client/CLI与生产接线，先冻结薄传输，领域独审后再启用worker。

- [x] F01-19：K03 owner固定版本知识context公共读取、021生产入口及直接消费者。保持公共原文/私有执行输入边界，独审后集成。

- [x] F01-20：流式正文公共读取与显式协商、022生产接线及旧页面兼容同批发布。
- [x] F01-21：持久补充指令公共client及受控中心挂载；实际SDK消费与final保护由后继独立纵向片段实施，默认不开放受理。

- [x] F01-22：单个目标节点原生只读执行的owner公共client与生产接线；领域与实际模型验收分别审查。

- [x] **F01-23** 补齐显式owner单个原生节点的CLI动作、稳定key及有界输入，保持fixture路径不变。

- [x] **F01-24** 公共client明确协商steering profile目录格式，每页保留协议，缺省旧兼容，不当执行授权。

- [x] F01-25：读取当前任务补充指令受理状态，保持任务/attempt身份与明确原因，缺省不启用；中心实现与可信开关另独审。

2026-10-06：F01-21～24的公共接线/默认关闭挂载和O09CLI已分别独审main32c；勾选仅本shared范围，不继承为真实steering或child语义验收。

- [x] **F01-26** Codex中心025生产接线，保持旧迁移/默认消费者，独立review后与R05B成套集成。

- [x] **F01-27** 通用native profile发布薄传输，保持旧Claude消费者类型与目录语义；独立HTTP/类型审查后供R05C消费。

- [ ] **F01-28** 配合TUI-001的共享ACK后继，将创建/提交会话的结构与冻结身份校验收敛到窄client Interface；唯一设计/验收归[TUI001-09](/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-client/docs/evidence/tui01/shared-ack-design.md)，不展开全API框架，不阻TUI01A局部修复。
