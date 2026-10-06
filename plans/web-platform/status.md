# WPF-001 状态

> 本文件的唯一持续维护权威是 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform`（branch `codex/web-platform-management`，owner d01_owner）。主线中的同路径是经独审、由Execution Lead同步的固定发布副本，不能据它推断当前进度；固定target、生成时间及同步规则见[发布说明](../../docs/evidence/web-platform/publication/README.md)。不得在main另建手填status。

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 20:53 UTC |
| Plan | [plan.md](plan.md) |
| 来源角色 | 总需求与协调索引，非执行task父层；六大task见成熟度来源 |
| co-lead | Web /root（执行管理 d01_owner） |
| 单一status owner / model | d01_owner（执行管理者）/ gpt-6-astra ultra |
| Worktree | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management` |
| Branch | `codex/web-platform-management` |
| 工作基线 / HEAD | d444608ab6c796c731e44e51a892868bf39bec2a；当前HEAD/dirty由Git聚合，不手填滚动SHA |
| 工作树dirty状态 | 当前事实与历史快照收敛仅管理范围；实际状态由Git聚合 |
| 工作分支状态 | in-progress；按轮验收，持续目标未宣称完成 |
| 阶段 | M2 |
| 本片段交付阶段 | integration |
| 优先级 | 1 |
| 当前产出 | 稳定前端的发送、排队和丢回执恢复已通过兼容验收并接入主线；逐消息设置控件已通过类型、定向行为和4项独立页面检查；看板时间格式修复已接入主线。 |
| 下一可用交付 | 完成已固定草稿辨识与回焦修复的独审和页面复验，接续已审设置控件主线接收及预览更新。 |
| 当前阻塞 | ACTIVE: 设置控件受控范围已获独立批准，真实发送/排队/恢复全旅程仍开放；草稿辨识与回焦两文件修复已固定待独审，尚未页面复验；最近共享准入资源不足，Web 无运行或预约。 |
| 需用户决定 | NONE |
| 实现目标 | a5e500136438b197305339cbe0a5e10a196a4317 |
| 实现范围 | plans/web-platform/plan.md,docs/evidence/web-platform/research.md,docs/evidence/web-platform/publication/README.md |
| 检查状态 | PASSED a5e500136438b197305339cbe0a5e10a196a4317；管理parser原发布27TODO/0errors、32md384links发布overlay相对断链0、U00–U12/REQ01–45齐、diffcheck0；仅文档检查，不继承c075审批 |
| 已集成main状态 / HEAD | INTEGRATED f181d84b5fb3652d62e2a181acff442d42b3e066：D08/ACTIVITYREAD/STEIRI获审源码相同、owner收口后释放。个人产物及4320部署另计；管理a5发布仍是原时点副本，不继承新产品审批 |
| Review | [review.md](review.md)，本次固定发布APPROVED a5e500136438b197305339cbe0a5e10a196a4317；root2026-10-06 07:59 UTC；历史c075仅见归档，不覆盖本次 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-001-01 | completed | d01_owner | U00～U12与WPF-REQ-01～45落[plan](plan.md)，REQ44后继pause/continue变更保持来源 |
| WPF-001-02 | completed | d01_owner | 七子计划三件套齐；六准备目录已转独立canonical stub；新增实现各自独立平级source |
| WPF-001-03 | completed | d01_owner | W01 cb4通过；SSE由M02 d47修复/复验，实证main已含 |
| WPF-001-04 | completed | d01_owner | 管理源和后继来源已实际聚合；05:31:45.221Z65源核QUEUE01新卡与D06唯一迁移/claim匹配 |
| WPF-001-05 | in-progress | d01_owner | P01/I01可信host与X02 registry已审集成；X03I01消费只读管理模块，完整npm生命周期/第三方隔离与conversation/pane入口仍开放；[连接页固定2498候选](../../docs/evidence/web-platform/connection-plugin-2498-intake.json)已核十源，唯一host/既有slot/preauth可信builtin与postauth撤权未实施，待Recovery交权 |
| WPF-001-06 | completed | d01_owner | PERF01基线3d47和PERF02窗口a87限定批准、后者main已含；d36 v2 released，未来优化另凭证据领取 |
| WPF-001-07 | completed | d01_owner | M02 d47已审集成，原保留范围已于06:45:37由owner完成main收口并release v4；后继不沿旧权写入 |
| WPF-001-08 | completed | d01_owner | D04 PG原子领取/实际dashboard详情已验；最新CHATv5→QUEUE01v1与旧D06v2释放→新e5b2v1均有原始receipt |
| WPF-001-09 | in-progress | d01_owner | CHAT与queue已审集成；GO/Lead真实两query结果CLOSED 2/2已收到，沿固定证据不重测；tool/thinking、context、steer、voice后继仍开放；04历史GET/client/DTO已main362 ready，Web consumer待排程；附件v2材料投影最小修复4f879已main cde，Lead组合PG2已验；实际backend362仍缺该修复，不冒完整材料展示 |
| WPF-001-10 | completed | d01_owner | X03I01实现84acdc获root限定APPROVED、final4b7e0f clean，管理scope/docs通过；main集成仍另计 |
| WPF-001-11 | completed | d01_owner | PROFILE独立模块4f198576获rootAPPROVED、finale730clean，管理范围/6md20links/4TODO通过；App接线仍另片 |
| WPF-001-12 | completed | d01_owner | QUEUE00 5acc已审，d10b4b0记录main698实现相同、claim13185v2 released |
| WPF-001-13 | completed | d01_owner | PROFILEI01固定2e4c获审/finalc1dc clean；36paths/10scope、6md37links4TODO与原样60源聚合通过；主线14c61已含，最后07cff记录main/7f1v2 released |
| WPF-001-14 | completed | d01_owner | DPERF5cd限定APPROVED/final4d7425 clean；5md15links3TODO/范围0越界，4新检查与旧关联失败分开；main6b4已含、08bd记录后bb7efv2 released |
| WPF-001-15 | completed | d01_owner | PROFILEUX55b获root限定APPROVED，60d8交付与5md27links3TODO通过，ef869记录main14c61；d113v2已release |
| WPF-001-16 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-17 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-18 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-19 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-20 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-21 | completed | d01_owner | C01固定8c562独审104通过、最终ee294；07:10:06管理核fa9主线祖先/两source相同；owner最终c155ed61 clean，ca26 v2于07:11:50.408Z released；未启用stream消费 |
| WPF-001-22 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-23 | completed | d01_owner | ACTIVITYC01固定889f433/root独立44通过、最终ce0608 clean，管理两hash/范围/parser/28links通过；07:10:06核fa9已含且两路径相同，owner最终b029f3a2 clean，5896 v2于07:11:50.505Z released |
| WPF-001-24 | completed | d01_owner | WPF-CHAT06S01独立web-conversation-stream，完整已审base fa9；d94ae4bb v1于07:10:10.763Z正式领取七新scope，固定3ac11cba/root54独审APPROVED，最终63b7a302 clean；五hash/proof/7md42links管理核验后已入6426；owner f367记录后d94 v2释放，实际App接线另片 |
| WPF-001-25 | completed | d01_owner | PERF03 f909/root8独审，最终7998已入6426且3源码相同；owner9cea记录后2ec58 v2释放，仅对象/转换计数，不声称浏览器收益 |
| WPF-001-26 | completed | d01_owner | CONTEXT01独立选择模块736ef/d6已审并入fc113，59b9650收口后bfe v2释放；实际App另属后继，不偷偷扩大本TODO |
| WPF-001-27 | completed | d01_owner | CHAT06I01 9da/e30已审并入32c、十一源同；owner8ca0684c纯main metadata后a729 v2已释放，实际服务/provider验收单列 |
| WPF-001-28 | completed | d01_owner | 既有局部交付与验收边界见[历史快照](status-history.md)；需求与稳定验收见[plan](plan.md)。 |
| WPF-001-29 | completed | d01_owner | READ527/2f858已main d7e，cd26404 clean后c832 v2 released；[审计](../../docs/evidence/web-platform/chatread01-final-audit.json) |
| WPF-001-30 | completed | d01_owner | D05FIT01 0ac7已main9d6，两源码相同；最终0e52826 pushed/clean，四scope停写且5dc v2释放；[canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-first-fit/plans/d05-first-fit/status.md) |
| WPF-001-31 | completed | workspace_panels_owner | STEER01 b2模块已main77c，01842收口后2bae v2释放；App与跨reload恢复属MATURE06后继。 |
| WPF-001-32 | completed | w01_owner | CONTEXTI 已正式main df29；fe2b收口/55fe v2释放，唯一source见当前表。 |
| WPF-001-33 | completed | d01_owner | 902c/aa715已main da041，收口8e9现remote一致/clean，1cb4 v2 released；push两次失败与先release偏差有原始记录；34.897s/16.08MB仅临时样本；[source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-proof-batching/plans/wpf-dashboard-proof-batching/status.md) |
| WPF-001-34 | completed | d01_owner | root10:44–10:45实际129来源页面核六parent/co-lead、三子片领取/父导航；[证据](../../docs/evidence/web-platform/mature-dashboard-ui-acceptance.json)。仅计划落盘/显示专项，不是六feature完成。 |

| WPF-001-35 | pending | d01_owner | RS13固定f82候选5asset/1,571,669 raw bytes仅观察，初始依赖图/延后chat及静态host cache-encoding冷暖与回滚验收已落plan；未take/实施，ACK/附件/发布优先，0个人服务/模型。 |

| WPF-001-36 | completed | d01_owner | D01/DPERF两组隔离原证据与六scope[只读第二意见](../../docs/evidence/web-platform/dperf03-readonly-proposal.json)已归档；新增末尾HEAD核对后原28→23初为算术预期，实施后仅该临时样本已实测23，captured HEAD/permit/失败unknown为门槛；ATTACHI02实际派工后已root结构批准并fresh db0b7d25 v2七scope实施（新增专测分类helper）；45s/10s清理/8MiB，独审5609 APPROVED，已main a8aef五源同；7cc5双端clean全停写后db0b v3 released；不泛化CPU/SLO。 |

## 当前唯一来源、写权与下一步

| 工作 | 唯一来源 / 写权 | 当前下一步 |
| --- | --- | --- |
| WPF管理 | 本worktree，632a7149 v3，仅两管理目录与四Web大task目录 | 管理索引只追溯；普通变化status→dashboard，不构成第三执行层 |
| ATTACH01 → MATURE03 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources/plans/wpf-attach01-resources/status.md)，ef617d78 v3 released十八scope | 已main fd1322、23批准源同；正式factory6项/8自动启动/无fallback归Lead；ownerc698双端clean全停写后ef617 v3释放 |
| RELEASE01 → MATURE01 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-release-compatibility/plans/wpf-release01-product-compatibility/status.md)，20a6529a v2 released四scope | 7805/db08已main c450，owner41276 pushclean后停写/release；format2与descriptor绑定，个人发布仍Lead |
| VISUAL01 → MATURE01 | [视觉source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-visual-shell/plans/wpf-visual01-shell/status.md)，原d01_owner，35e5 v3 released，九scope停写 | 已main4391，558895d已push/clean并release；个人产物由SVC04发布，原树只读 |
| CONTEXTI01 → MATURE03 | [知识App source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-integration/plans/wpf-context-i01-integration/status.md)，原w01_owner，55fe v2 released，二十scope已停写 | 已main df29；fe2b收口后55fe v2 released，原树只读 |
| STEIRI01 → MATURE06 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-integration/plans/wpf-steer-i01-integration/status.md)，原w01_owner，bc0ded75 v2 released | 已main f181；8273 push/clean后13scope停写释放，原树只读 |
| ACTIVITYREAD01 → MATURE06 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-readability/plans/wpf-activity-readability/status.md)，原panels，6f427ac5 v3 released | 已main f181；be977 push/clean后6scope停写释放，仅展开活动区 |
| D08 → D01 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-task-links/plans/d08-task-links/status.md)，原panels，49510580 v2 released | 已main f181；605957 push/clean后9scope停写释放；root实际六计划父关联/take页面核已完成 |
| STEER01 → MATURE06 | [模块source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-steering-control/plans/wpf-steering-control/status.md) | 已main77c，2bae v2 released；原树只读；实际App接线现属STEIRI01独立13scope，原模块不再写 |
| D05FIT01 | [已交source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-first-fit/plans/d05-first-fit/status.md) | 已main9d6/5dc v2 released；registry证据路径纠正仍现registry owner处理 |
| RELEASE02 → MATURE01 | web-release-type-fix / 03323bce v2 released三scope | fixed560c已Lead独审并main648e；ownerfed5 normalpush双端clean/parser0后全停写，03323 v2已release；0浏览器/PG/个人发布 |
| ATTACHI01 → MATURE03 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-input-preview/plans/wpf-attach-i01-input-preview/status.md)，94b84c59 v2 released十一scope | fixed4c4d已main1c496九源同，owner2b0a33e双端clean/parser0后全停写；94b84 v2 released，实际App仍属新生产绑定片 |
| ATTACHI02 → MATURE03 | web-attachment-production / 0b7fc000 v4 released二十六scope | fixed9eec二十四源已main cde；owner5069586双端clean全停写后v4释放，后继Recovery独立fresh21领取；个人服务未切 |
| WORKSPACEPERF01 → MATURE05 | c815bc00 v2 released四scope / web-workspace-lifecycle-baseline | fixed1711已正式main362af3两源同；owner12e4双端clean/全停写后c815 v2 released；8完成/1失败、累计79.322s保持partial，0生产优化 |
| DASHSUM01 → D01 | dashboard-human-summary / fe63511a v2 released六scope | fixedc1de已main017adc，owner2daf070双端clean/parser0后全停写；fe635 v2正式释放，root148既有DOM已核顶部不同大task，未复验领取详情 |
| WORKSPACECACHE01 → MATURE05 | web-workspace-cache / 883321bc v2 released十六scope | fixed4ec已main017adc、十四hash同，owner10ca8双端clean后全停写/883321 v2释放；含六ATTACHI交集；原分次browser限制保留 |
| ACK01 → MATURE06 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-ack-consumer/plans/wpf-ack01-shared-consumer/status.md)，a2674416 v2 released七scope | 2fa8已main e4c82；owner8301991 normalpush/clean后全停写释放；v2公共扩展已fd1322接收，生产附件consumer另片 |
| DPERF03 → D01 | dashboard-git-snapshot / db0b7d25 v3 released七scope | fixed5609获root独立37/37批准，finalcc390双端clean/5源同/13只读依赖同；已main a8aef，owner7cc5双端clean后v3释放；原临时Git2.151s/原失败/非原子边界保留 |
| DPERF02 → D01 | [source](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-proof-batching/plans/wpf-dashboard-proof-batching/status.md)，1cb4 v2 released四scope停写 | 已main da041，close8e9最终normalpush成功；两次失败/先release偏差已归档，无重测 |

## 当前依赖与登记队列

- 六大task与Mika02/04唯一canonical、用户原话/Arc抽象、登记字段与待集成目标统一见[集中handoff](../../docs/evidence/web-platform/mature-task-handoff.md)。Web只拥有01/03/05/06，02/04不复制计划。
- Lead09:09:25正式观察111 sources/current/issues[]，六MATURE/CONTEXTI/STEER/VISUAL已登记；本管理不重复API。D08已main f181；root10:44–10:45实际页面已核六parent与子片父/worker领取；MATURE04 stale已自恢复，剩余声明格式交Mika合法owner。
- root12:24既有DOM已核148来源、main a8aef、顶部三大task分散；Lead同期ledger available/unregistered[]，没有展开领取详情或本组API采样；[精确观察](../../docs/evidence/web-platform/dashboard-148-root-dom-observation.json)。
- 原下一完整旅程沿MATURE06-04；中心582f/共享d6d/生产9406已main84005。Recovery原21领取/首canonical dcaf属于历史启动；当前7cc受控38/38与真实browser未复验/正式未全审边界见页首及唯一owner status，不能沿旧dirty描述推断当前状态。[接口/写权队列](../../docs/evidence/web-platform/connection-recovery-readonly-proposal.json)。
- D05 registry evidenceDir应为docs/evidence/d05-first-fit；现owner仍Lead队，仅其可修registry，本组不抢写。
- CONTEXTI已main并释放；STEIRI01、ACTIVITYREAD和D08已main f181并全部停写释放，source见集中handoff。
- GO已将MATURE03附件端到端责任交Web/root；运行域及实际ATTACHI02已main cde且旧scope释放，完整MATURE03目标仍开放；CACHE也已main/released。新RECOVERY01仅用自己fresh21claim，不沿已释放写权。
- 跨lead接口/资源裁决才有界直接协调；GO每完整大task只独立blocker与Done一次。无不可解除的整体阻塞；用户再次要求take在dashboard明确展示、各lead防overlap，已核plan U08/U12与REQ37完整覆盖；fresh COMMITTED后才写、停止后fresh release及其账本展示保持验收项。

## 当前服务与验收边界

SVC05窗口已由Lead正式关闭，个人backend362/v15与Web8d8/caa1/v2沿服务owner固定receipt；本组无新个人服务采样。原Flow临时detached只属已结束操作窗口，不当源码回退；当前恢复输入固定84005。实际registry/页面发布另依Lead回执，不因新take假称已展示。

完整聊天/附件/主题插件材质/组合tab/真实多provider/context用量/语音成功路径仍按六大task开放验收。局部fixture/独审/main/个人产物分别记录。GO历史真实queue2/2封存结果只引用原证据，本组0真实模型/语音调用，不重复他队实验。

## 证据与历史入口

[本次收敛前原文历史](status-history.md)保留原时点、失败、未验、SHA与原始证据链接；仅历史不得更新成第二状态源。[plan](plan.md)保留完整U00–U12/REQ01–45与稳定36TODO；[research](../../docs/evidence/web-platform/research.md)记录研究依据；[固定发布说明](../../docs/evidence/web-platform/publication/README.md)界定a5独审副本；[本轮成熟度handoff](../../docs/evidence/web-platform/mature-task-handoff.md)供正常登记/集成。

[RELEASE03候选/批准范围](../../docs/evidence/web-platform/release03-current-preview-proposal.json)直接MATURE01；历史bfb209ae v1四scope启动已完成，本片现已main/released；两cacheprepare已完成并释放，见[take与释放](../../docs/evidence/web-platform/release03-prepare-release-receipt.json)；不复用RELEASE01/02释放权，不抢Recovery。原SVCoperator独立接精确descriptor/compatibility后发布；个人服务未操作。

恢复正式领取与唯一来源见[dispatch审计](../../docs/evidence/web-platform/recovery01-dispatch-audit.json)和[回执](../../docs/evidence/web-platform/recovery01-take-receipt.json)；当前实施事实由新owner status维护，不由管理表复制TODO。13源比对不是13tests，Lead组合为1pass/2未选+types0；本组无产品复测。

历史DPERF后继研究：[单次首页观察/固定摘要设计](../../docs/evidence/web-platform/dperf-home-summary-followup.json)待排，优先级低于恢复与可用预览、高于装饰。已交DPERF01–03不回改；当时尚未领取的阶段已由下述DPERF04正式claim推进，当前不复采服务。

[DPERF04精确后继候选](../../docs/evidence/web-platform/dperf04-summary-detail-proposal.json)已收敛为direct D01 / w01 / 九literal，原结构批准/Lead provision后已b554v1领取并实施；当前固定源与检查见页首、唯一owner status。小源码独立于Recovery，实际检查仍守各自门槛。恢复82d78原五项与W01新增三项合计[八项早期partial发现](../../docs/evidence/web-platform/recovery01-foundation-review-intake.json)，已交唯一owner，非完整独审结论。


连接页插件方案仅归WPF-001-05/REQ22–23：[原报告](../../docs/evidence/web-platform/connection-plugin-2498/report.md)与[来源核验](../../docs/evidence/web-platform/connection-plugin-2498-intake.json)为只读候选，六产品+两专测不是已领取范围。Recovery724当时RB1–3源码审查和22direct未跑只是历史；当前1b8与27受控检查见页首，真实browser未验。本管理不以历史研究扩产品写权。

DPERF04直接D01子task已[原九scope COMMITTED](../../docs/evidence/web-platform/dperf04-take-receipt.json)，W01独立树源码派工；[首canonical704894已正常推送且parser0](../../docs/evidence/web-platform/dperf04-source-ready.json)，registry与页面展示不由此推断。原DPERF03/WPF-001-36完成记录保持原范围。

历史A3原始结果已由Lead接收；随后next12b完成、一次all两A通过/B locator失败与窗口归还见页首。[c18bd标签窄审](../../docs/evidence/web-platform/release03-c18bd-label-review-root.json)只批准报告逻辑，完整A/B仍未通过。该段仅A3历史；后继完整af51+d629限定兼容已获批准并main，见页首和RELEASE唯一owner status，不以标签审查替代实际结果。

MATURE02仍链接Mika唯一plan/TODO-11：[原固定公共输入研究](../../docs/evidence/web-platform/mature02-message-settings-consumer-intake.json)保留早期C01缺口；当前固定8d84输入已供W01原8范围实现，源码ed769后UI窄修与检查准备见[当前派工](../../docs/evidence/web-platform/mature02-message-settings-source-request.json)。App/outbox/Recovery接线仍后继串行，不把目录配置当账号资格或SDK observed。

本安全点可聚合入口：[设置控件固定base/唯一owner/原8take](../../docs/evidence/web-platform/mature02-message-settings-source-request.json)、[RELEASE main/release](../../docs/evidence/web-platform/release03-main-intake.json)、[Recovery首轮失败与清理](../../docs/evidence/web-platform/recovery01-browser-first-intake.json)。任务进度仍取各owner唯一status；[Lead18:15:17登记/实际来源回执](../../docs/evidence/web-platform/message-settings-registration-intake.json)只证明来源展示，未证明设置功能已交付。
