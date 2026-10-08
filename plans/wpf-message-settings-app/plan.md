# WPF-MESSAGESETTINGS03 · 真实聊天消息设置

状态：in-progress（原MSGAPP-01–06交付完成；同任务versioned creation后继开放）；开工2026-10-07T12:11:30.621Z；原MSGAPP-01–06完成2026-10-07T14:50:23.195Z，来源见唯一status及main-closeout。
所属大task：[WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)，既有 TODO11 实施子片；co-lead Web/root，执行管理 d01_owner。唯一owner workspace_panels_owner / gpt-6-astra；本树 codex/web-message-settings-app，固定base c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50。

目标：用户在真实聊天入口选择完整模型/思考/速度设置，Send、Queue、已发送记录及草稿恢复保留各自快照。已审组件六组通过不等本片真实App通过。

## 既定接口与验收

沿[已审设计](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/accepted-host-design.md)：App每view唯一C及私有opaque ownership，复用P01 action/context、现Picker同步CAS、官方Thread和公有client。发送前同步捕获A并更新新稿ownership；材料await期间新B即使正文相同也保留。Send/Queue原key/body深冻结，retry不读取liveC。Recovery完整draft保存/恢复settings且兼容缺省旧稿；invalid不静默omit。历史turn/Queue展示自身frozen requested，不拿当前C替代。没有第二store/FSM/slot或共享contract改动。long names有界且全值可查，Apply/Cancel在窄屏可达。

## TODO

- [x] **MSGAPP-01** 固定供给、原18scope领取（后续合法amend为19，再为共享附件投影amend为20）和canonical；[原件](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/receipt.json)。
- [x] **MSGAPP-02** App ownership/P01宿主接线与紧凑消息设置入口。
- [x] **MSGAPP-03** Send/Queue材料await前完整freeze、同正文异设置保留、原key重试及历史requested显示。
- [x] **MSGAPP-04** CompleteDraft/Recovery全链、同步CAS与失效边界；第四mounted暴露持久B混held A；b924共享selector修复已过定向局部和修后两条mounted实际，保留旧FAIL。
- [x] **MSGAPP-05** 有界受影响direct/types与真实App浏览器验收；证据/失败/cleanup保真。
- [x] **MSGAPP-06** 独立review与合法main接收；root精确18源批准、main3c9345逐字核同及Original noEmit0，个人部署不外推。


## 当前同任务后继（MATURE02 TODO08/11）

- [ ] **MSGAPP-07** 显式versioned创建选择/required tuple与Recovery完整身份的消费者组合。纯基础e5/root027415限定完成；合法App/Thread/Picker接线、组合验证与main接收仍OPEN。不得单独合入四叶或沿已释放产品权编辑。

[后继来源、准确时点与检查](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/versioned-creation-successor-20261008/README.md)。原01–06完成时间与18源码main历史保持；不建立新task或第二status。

## 验证与边界

历史首段local累计60,000ms，每次≤20,000ms含≥5,000ms cleanup；1Node顺序，TMP16MiB/raw2MiB，0network/PG/Chrome/provider/install/build。当前futurefresh组合门槛≥7,515,275,264B或最新完整组合更高值；旧执行门槛保历史。只明确files noEmit与新增/直接受影响选组，不以稀疏include冒wholeWeb。不自动运行旧Recovery browser或旧全绿。
真实Browser/HTTP/PG后续另按实际资源交接，不读取个人凭据。原Recovery记录只读不改、新输出归本evidence。具体scope见[request](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/request.json)。常规source operator旧等待已由e029现规则与d01授权解除；不新增审批链。

## 历史实施与验证安全点

以下按原时间保留历史source、等待与失败；当前实现固定fcf5/产品b924，两条原mounted均已实际通过，MSGAPP-06独审与合法main3c9345已完成；下文保留当时等待与失败。历史预算与NEXT不延续到当前。

### 当时固定实现与未验边界

MSGAPP-02/03 勾选指源码实现；当前组合绑定 b92470377349dea17a12d0abc244f0fed7992e33，不代表独审或浏览器通过。新增 AttachmentComposer 私有可选 restore/discard 接缝已获 v2 exact19；保默认消费者。原 core 的 prepare failure/cancel 自动归还路径已用真实 installed core + 生产 guard 定向检查，完整 mounted App 材料恢复仍属于 MSGAPP-05。

历史11定向通过/57未选保留；新probe2六PASS/affected types8通过当时9c46的17源，local累计53579/60000ms。当前9c46 source/local限定独审通过，源码/实际范围见[单一review入口](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/feature-review-entry.md)。两个browser selector共享新90s防御总顶，每attempt≤60s含30scleanup；不是运行grant或旧Recoverycredit。首次PG初始化已实际FAIL并清理，材料旅程随后两次FAIL，消息设置旅程仍NOT_RUN，MSGAPP-06合法main仍pending。

## MSGAPP-05 当前 mounted 后继

真实上传进入官方材料prepare；实际App/core的失败与取消归还都保持B文本、设置与附件，并经用户清空/omit B显式恢复完整A。受控fixture adapter故障不冒自然网络失败；迟到resolve必须实际settle后再核无A dispatch。独立selector仍同一候选90s累计/每attempt≤60s含30s cleanup，不扩大runtime授权。

个人目录交付依赖（原TODO08/11）：受信opt-in publisher以turnSettings发布 → Web/TUI真实目录 → 个人配置发布；当前Claude无turnSettings的经理来源保留，不修改发布leaf、不以fixture目录代个人能力。

本批运行边界更正：worker不再继承Node execArgv中的父admin --env-file，固定tsx loader白名单；c4bee单行域差量由独立假sentinel新10s段实测old-negative/new-positive，exit0、charge219ms、双EOF及owned清理。原60s局部53579/6421未用封存不转credit。9c46 root8488批准保固定source/local范围；本新参数差量与具体outer capture已获root475e限定准备批准；首次初始化FAIL见实际记录。

## 2026-10-07 首次实际安全点

当前实现仍c4bee，执行头df185。首material-return在server初始化因固定c130 SQL017未物化失败，0组完成/无Chrome；实际exit1、双EOF、markedDB正常DROP和owned资源清理闭合，首红不重写。其后按原source-operator补017/019共3278B，全33SQL等fixedbase；这是依赖供给修复。根475e准备批准保留，不作实际PASS。当前90s phase spent3432/remaining86568，后继实际仍须fresh唯一资源与新输入；无当前holder。入口：[首轮原件](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/browser-attempts/material-first/manifest.json)，[SQL供给](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/runtime-sql-supply.json)。

MSGAPP-05历史第二次安全点：两次actual保红，第二cookieRead通过/材料选项失败；仅fixture公开目录header透传修复，target 424c6466bd28a838b91cc490a7b52021202b4d17。新90s phase18962/余71038，相关复验待fresh窗口，未扩大场景或预算。

MSGAPP-05第三actual：worker未处理filechooser超时提前exit1，缺场景/fixture回执；父资源回收有证但不冒优雅close。源target 6a258a3886f0491b8487738c19c09dc631b98f2c 只修错误观察；本phase33766/56234，禁止自动重试，原两selector未完成。

当前6a错误观察差量已独审APPROVED；不代表修复chooser交互根因或actual通过。原phase33766/56234、第三缺fixture回执保持，当前无NEXT、不运行。

MSGAPP-05同scope前置修复：仅实际Files命令初始化后再用official Add Attachment；源61185尚未actual，原3FAIL/33766/56234不变，非产品自动激活改动。

61185源码聚焦审通过（root09907），仍原MSGAPP-05真实材料/消息设置验收未完成；无本批工程检查或运行。

MSGAPP-05第四actual已进入真实材料failure/cancel：failure完整显式恢复有原件，cancel可见B保留但持久B附件混入held A，组FAIL。当前实现61185未变；90s实际51110、余38890低于min45s封闭，不启动下一旅程。后继须修持久完整草稿隔离，不能用可见chip数量代持久身份。原MSGAPP-03/04勾选为源码交付，不表示该实际缺陷已解决。

## 当前 MSGAPP-04 修复安全点

共享Attachment成员选择由原draftItems统一：Recovery不得把held inventory当当前稿；已returned/restored当前A优先、unbind后复用既有restoredDraftIds，未验证选择和顺序不丢。原20scope下两产品+1test完成，1 PASS/68未选、受影响noEmit0；本新20s局部14680已耗，余5320封存。旧mounted90s51110/38890 CLOSED，无新browser。当前源审/真实页面验证仍需完成，不能把局部结果勾成MSGAPP-04/05全部完成。

## MSGAPP-05 修后独立页面工作段

新120s仅覆盖原material-return与message-settings-app，二者同账/每attempt最多60s、至少45s且含30s清理；旧90/局部各phase封闭。新父入口明确独立ID/旧账hash/新run目录，原断言不变。准备不占资源；没有本批actual，经理统一安排。

## 修后材料selected实际

[material原件](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/browser-attempts/membership-material/manifest.json) selected2 PASS，scope仅cookieRead+messageSettingsMaterialReturn；原四FAIL不回写。新120phase charge13353/rem106647，完整ownedRETURN，0PNG；第二message-settings-app尚未执行。fcf5预算绑定已获rootf05批准，actual根独审待；不重跑通过材料。

MSGAPP-04/05完成依据：修后两个实际selector各2/2，完整草稿/B隔离/显式恢复、P01与冻结SendQueue/history、真实两主题390均按原断言执行。旧四FAIL不追改。新120s累计26368/余93632 CLOSED；06仍须root组合审及合法main，不把个人provider目录跨owner交付冒为本树已部署。

当前MSGAPP-06进展：root最终组合审c1c340批准fcf5精确18源受控接收，review部分完成；main未接，TODO保持开放。个人发布/完整native四facet键盘不由本两selector外推，P3窄屏scrollbar只保原视觉后继。

## 最终接收

原六TODO按本登记范围全部完成，证据见[主线接收核验](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings-app/docs/evidence/wpf-message-settings-app/main-closeout-20261007/verification.json)。个人目录/部署及既有视觉后继归原共享owner，本片不新加provider或未选旅程门槛，也不外推已验。
