# WPF-MESSAGESETTINGS03 · 真实聊天消息设置

状态：in-progress；开工 2026-10-07T12:11:30.621Z；最近更新 2026-10-07T12:13:29.338Z。
所属大task：[WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)，既有 TODO11 实施子片；co-lead Web/root，执行管理 d01_owner。唯一owner workspace_panels_owner / gpt-6-astra；本树 codex/web-message-settings-app，固定base c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50。

目标：用户在真实聊天入口选择完整模型/思考/速度设置，Send、Queue、已发送记录及草稿恢复保留各自快照。已审组件六组通过不等本片真实App通过。

## 既定接口与验收

沿[已审设计](../../docs/evidence/wpf-message-settings-app/accepted-host-design.md)：App每view唯一C及私有opaque ownership，复用P01 action/context、现Picker同步CAS、官方Thread和公有client。发送前同步捕获A并更新新稿ownership；材料await期间新B即使正文相同也保留。Send/Queue原key/body深冻结，retry不读取liveC。Recovery完整draft保存/恢复settings且兼容缺省旧稿；invalid不静默omit。历史turn/Queue展示自身frozen requested，不拿当前C替代。没有第二store/FSM/slot或共享contract改动。long names有界且全值可查，Apply/Cancel在窄屏可达。

## TODO

- [x] **MSGAPP-01** 固定供给、唯一18scope领取和canonical；[原件](../../docs/evidence/wpf-message-settings-app/receipt.json)。
- [ ] **MSGAPP-02** App ownership/P01宿主接线与紧凑消息设置入口。
- [ ] **MSGAPP-03** Send/Queue材料await前完整freeze、同正文异设置保留、原key重试及历史requested显示。
- [ ] **MSGAPP-04** CompleteDraft/Recovery全链、同步CAS与失效边界。
- [ ] **MSGAPP-05** 有界受影响direct/types与真实App浏览器验收；证据/失败/cleanup保真。
- [ ] **MSGAPP-06** 独立review与合法main接收；本分支通过不冒主线/部署。

## 验证与边界

本段local累计60,000ms，每次≤20,000ms含≥5,000ms cleanup；1Node顺序，TMP16MiB/raw2MiB，0network/PG/Chrome/provider/install/build。fresh组合门槛≥6,237,454,336B。只明确files noEmit与新增/直接受影响选组，不以稀疏include冒wholeWeb。不自动运行旧Recovery browser或旧全绿。
真实Browser/HTTP/PG后续另按实际资源交接，不读取个人凭据。原Recovery记录只读不改、新输出归本evidence。具体scope见[request](../../docs/evidence/wpf-message-settings-app/request.json)。常规source operator旧等待已由e029现规则与d01授权解除；不新增审批链。
