# WPF-MESSAGESETTINGS03 · 真实聊天消息设置

状态：in-progress；开工 2026-10-07T12:11:30.621Z；最近更新 2026-10-07T13:12:22.793544+00:00。
所属大task：[WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)，既有 TODO11 实施子片；co-lead Web/root，执行管理 d01_owner。唯一owner workspace_panels_owner / gpt-6-astra；本树 codex/web-message-settings-app，固定base c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50。

目标：用户在真实聊天入口选择完整模型/思考/速度设置，Send、Queue、已发送记录及草稿恢复保留各自快照。已审组件六组通过不等本片真实App通过。

## 既定接口与验收

沿[已审设计](../../docs/evidence/wpf-message-settings-app/accepted-host-design.md)：App每view唯一C及私有opaque ownership，复用P01 action/context、现Picker同步CAS、官方Thread和公有client。发送前同步捕获A并更新新稿ownership；材料await期间新B即使正文相同也保留。Send/Queue原key/body深冻结，retry不读取liveC。Recovery完整draft保存/恢复settings且兼容缺省旧稿；invalid不静默omit。历史turn/Queue展示自身frozen requested，不拿当前C替代。没有第二store/FSM/slot或共享contract改动。long names有界且全值可查，Apply/Cancel在窄屏可达。

## TODO

- [x] **MSGAPP-01** 固定供给、原18scope领取（后续合法amend为19）和canonical；[原件](../../docs/evidence/wpf-message-settings-app/receipt.json)。
- [x] **MSGAPP-02** App ownership/P01宿主接线与紧凑消息设置入口。
- [x] **MSGAPP-03** Send/Queue材料await前完整freeze、同正文异设置保留、原key重试及历史requested显示。
- [x] **MSGAPP-04** CompleteDraft/Recovery全链、同步CAS与失效边界。
- [ ] **MSGAPP-05** 有界受影响direct/types与真实App浏览器验收；证据/失败/cleanup保真。
- [ ] **MSGAPP-06** 独立review与合法main接收；本分支通过不冒主线/部署。

## 验证与边界

本段local累计60,000ms，每次≤20,000ms含≥5,000ms cleanup；1Node顺序，TMP16MiB/raw2MiB，0network/PG/Chrome/provider/install/build。当前futurefresh组合门槛≥6,953,631,744B或最新完整组合更高值；旧执行门槛保历史。只明确files noEmit与新增/直接受影响选组，不以稀疏include冒wholeWeb。不自动运行旧Recovery browser或旧全绿。
真实Browser/HTTP/PG后续另按实际资源交接，不读取个人凭据。原Recovery记录只读不改、新输出归本evidence。具体scope见[request](../../docs/evidence/wpf-message-settings-app/request.json)。常规source operator旧等待已由e029现规则与d01授权解除；不新增审批链。

## 本段固定实现与未验边界

MSGAPP-02/03/04 勾选指源码实现，绑定 c4bee7707a273e98ba7b07dc061ec13e78094c2f，不代表独审或浏览器通过。新增 AttachmentComposer 私有可选 restore/discard 接缝已获 v2 exact19；保默认消费者。原 core 的 prepare failure/cancel 自动归还路径已用真实 installed core + 生产 guard 定向检查，完整 mounted App 材料恢复仍属于 MSGAPP-05。

历史11定向通过/57未选保留；新probe2六PASS/affected types8通过全部当前17源，local累计53579/60000ms。当前9c46 source/local限定独审通过，源码/实际范围见[单一review入口](../../docs/evidence/wpf-message-settings-app/feature-review-entry.md)。两个browser selector共享新90s防御总顶，每attempt≤60s含30scleanup；不是运行grant或旧Recoverycredit。全部真实页面/HTTP/PG/Chrome仍NOT_RUN，MSGAPP-06合法main仍pending。

## MSGAPP-05 当前 mounted 后继

真实上传进入官方材料prepare；实际App/core的失败与取消归还都保持B文本、设置与附件，并经用户清空/omit B显式恢复完整A。受控fixture adapter故障不冒自然网络失败；迟到resolve必须实际settle后再核无A dispatch。独立selector仍同一候选90s累计/每attempt≤60s含30s cleanup，不扩大runtime授权。

个人目录交付依赖（原TODO08/11）：受信opt-in publisher以turnSettings发布 → Web/TUI真实目录 → 个人配置发布；当前Claude无turnSettings的经理来源保留，不修改发布leaf、不以fixture目录代个人能力。

本批运行边界更正：worker不再继承Node execArgv中的父admin --env-file，固定tsx loader白名单；c4bee单行域差量由独立假sentinel新10s段实测old-negative/new-positive，exit0、charge219ms、双EOF及owned清理。原60s局部53579/6421未用封存不转credit。9c46 root8488批准保固定source/local范围；本新参数差量与具体outer capture待集中运行边界审，当前仍无PG/Chrome/gate/env。
