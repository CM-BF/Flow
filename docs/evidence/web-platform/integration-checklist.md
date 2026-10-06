# Web 平台跨 owner 集成清单

2026-10-06 03:44 UTC；这是路径、接口及待集成项登记，进度事实以各唯一status为准。原Execution Lead单独负责集成main、根lock、总索引与4320；我方不修改这些文件/服务。

## Dashboard来源登记与核验

root于2026-10-06T03:12:04.035Z实核下列五个唯一平级源及human字段完整，PERF claim匹配；管理者03:17:14.324Z专项确认30源包含旧8c57登记的17原ID。每项事实仅来自其planDir/status.md，JSON与网页只派生；管理nested现六个转交stub不注册第二源；下表前五项已实采，新增两项已交Lead待其注册批次，不能合称全部已聚合。

| Task | Worktree | Branch | planDir | evidenceDir |
| --- | --- | --- | --- | --- |
| WPF-001 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management | codex/web-platform-management | plans/web-platform | docs/evidence/web-platform |
| WPF-M02 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace | codex/web-unified-workspace | plans/wpf-m02-web-workspace | docs/evidence/wpf-m02 |
| WPF-P01 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host | codex/web-plugin-host | plans/wpf-p01-plugin-host | docs/evidence/wpf-p01 |
| WPF-I01 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration | codex/web-plugin-integration | plans/wpf-i01-plugin-integration | docs/evidence/wpf-i01 |
| WPF-PERF01 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-performance | codex/web-performance | plans/wpf-perf01-web-performance | docs/evidence/wpf-perf01 |
| WPF-PERF02（待注册核验） | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window | codex/web-activity-window | plans/wpf-perf02-activity-window | docs/evidence/wpf-perf02 |
| WPF-CHAT01（待注册核验） | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations | codex/web-conversations | plans/wpf-chat01-conversations | docs/evidence/wpf-chat01 |

WPF-D01仅协作，无第二dashboard实现；五源已经实际聚合，未知/未验证项仍来自各owner。来源登记不是实现/测试/review或main集成通过。专项旧源比对见[原始事实摘要](dashboard-source-verification.json)。

D03由主线单owner负责紧凑中性视觉及当前阶段/当前工作/下一交付/真正决策、历史下钻、实现review与metadata区分、main与旧SHA区分。WPF-D01只协作需求与来源，不另派实现、不切换4320。每个唯一owner已收到8字段规范，由各自更新，管理者不代写。

## 历史W01交付输入边界与版本（原实现现已冻结）

| Owner | Worktree / branch | 独占写入 | 依赖与交接 |
| --- | --- | --- | --- |
| w01_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` / `codex/m1-web` | apps/web、plans/w01-web、docs/evidence/w01；workspace子目录在panels提交合入前不并发改 | 官方Thread基于已装assistant-ui0.15.23兼容registry；registry全部精确依赖版本以该树package.json及证据为准。根lock只按原handoff临时安装例外，交patch后恢复，由Lead统一集成 |
| workspace_panels_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-panels` / `codex/web-workspace-panels` | apps/web/src/components/workspace、docs/evidence/w01/workspace-panels | 固定AI Elements源码6a9d5b1822ffb10bba4bd97175f01edd7d8651cd，Apache2.0；ansi-to-react6.2.6与W01统一管理；组件SHA交W01显式cherry-pick复验 |
| d01_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management` / `codex/web-platform-management` | plans/web-platform、docs/evidence/web-platform | 纯管理文档，无生产依赖；固定base d444608ab6c796c731e44e51a892868bf39bec2a |

## 共享能力需求（不在当前W01伪造）

- 现冻结契约仅TimelineEntry text/reference与Detail kind/content/mediaType；无真实PTY会话、stdin/stdout通道、文件目录list/read或可信path。当前UI明确任务输出/任务产物，未来能力由Lead统一contracts/client及权限边界后消费。
- 主线M02已提供统一workspace/queryTasks契约，WPF-M02 d47消费已获审并进入main3773；未来PTY/fs仍是独立BR-01，不在Web另造中心命令。
- WPF-P01是X01 Web插件host子项；请求Lead对齐能力ID/权限作用域/API版本/第三方隔离/配置与完整npm生命周期。原P01协议计划不改名、不抢共享接口。
- 原Lead更新plans/README总索引和派工交接，登记WPF-001及独立后续计划关系。只有实际实施owner转移时受控修改权威来源，不能任意树的陈旧status覆盖owner。

## 验证与交付门槛

当前新代码先测本模块及直接依赖；共享接口变化才测链路，metadata只核对内容/链接/ID/diff。W01仍须真实新任务/拒绝失败草稿/迟到受理关闭、双task观察、split/merge、详情隔离/懒读、显式cancel和keyboard/主题/窄屏；fixture与真实中心严格分开。最终回传完整SHA、dirty、启动URL、检查scope、双主题截图、官方来源/技能/clean-code、未验证及reviewtarget，不把候选commit当approval。


## WPF-REQ-32 后端能力请求（BR-01，提交接收，不假设已有）

接收协调owner：原Execution Lead；接收实现工作线：Runner owner（执行位置/文件与PTY能力）、M02/contracts/client owner（统一公共定位/权限/事件）、X01 owner（capability provider及插件授权）。这是请求的责任分配，主线收到后登记具体唯一owner/worktree/计划ID；我方不擅自分派其agent或修改共享契约。优先只读能力，交互shell独立验收，当前W01不等待它们继续真实引用/文本交付。

| 请求 | 用户动作与精确语义 | 最小公共接口建议（由Lead定稿） | 解除条件 / 验收 |
| --- | --- | --- | --- |
| BR-01-A 定位与能力发现 | 用户选中任务，在右侧查看它实际关联的工作区与可用能力；不能从浏览器本机路径猜runner位置 | taskId查询workspace descriptor：稳定workspaceId、runnerId、attempt/ownerVersion、可用capabilities、只读显示名；没有工作区返回明确unavailable。后续请求带taskId/workspaceId及当前attempt版本防旧租约串任务 | 主线指定权威runner/task/workspace映射及版本；fixture和真实runner各证明任务A/B位置隔离，迁移/过期版本返回结构化不可用而非读错工作区 |
| BR-01-B 只读文件浏览 | 用户展开FileTree、选文件tab看内容；不允许输入任意宿主绝对路径，不隐含写文件、执行或pty | listWorkspaceEntries(taskId, workspaceId, parentResourceId?, cursor?) 返回opaque resourceId、displayName、kind、版本/大小与nextCursor；readWorkspaceFile(resourceId, expectedVersion, bounded range?) 返回内容/mediaType/版本/截断状态。服务端限定runner分配根和允许范围，realpath/symlink与大小限制均在服务端执行 | Lead给contracts/client SHA、错误模型和例子；真实测试分页、二进制/超限、版本变化、消失文件、穿越/绝对路径/symlink拒绝；Web明确只读且懒读/缓存按workspace+resource+version，不跨task |
| BR-01-C 只读进程日志 | 用户打开“任务日志”查看实际进程输出、断线后接续；模型回复仍是任务消息，不声称stdout | listLogStreams(taskId, attemptId) 返回流id/source/channel；read/watchLog(streamId, afterSequence, bounded limit) 返回seq、timestamp、channel stdout/stderr/system、text与结束/截断/保留边界。若只提供合并输出须明示channel unknown，不能Web推测 | Runner产生真实进程日志并与attempt绑定；重连不丢/不重复、保留超期reset明确、退出后只读可看；无stdin接口的日志不能显示交互shell输入 |
| BR-01-D 交互shell（独立能力） | 用户明确打开交互终端，输入命令、调整尺寸、显式终止；连接/关tab仅detach观察，不能默认取消Flow任务或杀session | capability受权openTerminal(taskId, workspaceId, columns, rows) 返回terminalSessionId及生命周期；attachTerminal(afterSequence)输出；writeTerminalInput(sessionId, sequence/idempotencyKey, data)；resizeTerminal；显式terminateTerminal。需说明PTY进程owner、断连保留时限、退出状态、lease迁移规则；不复用Task.cancel作为关闭tab | 主线X01/Runner确认权限、可用shell/工作区/资源限制与能力作用域；真实PTY验证交互输入、尺寸、断连重附、顺序与重复防护、退出/超时、A/B隔离、明确终止；CLI同能力入口或明确阶段缺口 |

BR-01当前解除状态：未接收实现SHA/具体owner登记，四项均未验证。当前UI仅支持真实任务文本/引用/Detail，源码不会因本文新增假API。主线接收后给唯一计划/owner、contracts/client精确SHA与调用例子；Web消费独立新迭代，先局部接口/直接依赖测试，共享链路变化再做真实runner端到端。


## M02 Web消费队列增量

WPF-M02早期草案曾在管理树`plans/web-platform/unified-workspace/status.md`记录；现已实际派发并转移交stub，唯一事实源见下节平级wpf-m02-web-workspace，不再更新旧草案。主线输入origin/codex/m2-workspace完整e888862570cba3c59789053e68df7d5720650c36，后端clean；不得只拿405529d漏types。新Web功能在当前W01稳定候选后独立worktree实现，保留现chat、官方Thread和panels；后端PG5/CLI14/client3证据不作为Web通过。集成时由Lead选包含完整M02的基线/统一rootlock，不由Web改共享契约。


## 唯一来源实际转交：WPF-M02

已创建新tree并建立唯一status，管理草案三文件已转移交stub。请Lead/D03增加平级安全源：id `WPF-M02`、title `Web统一工作入口`、role `工作线`、worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace`、branch `codex/web-unified-workspace`、planDir `plans/wpf-m02-web-workspace`、evidenceDir `docs/evidence/wpf-m02`。不聚合旧nested草案。初始化W01 cb4a392+完整M02 e888862合并c0c41f9881713f3b371ba62c8f4e68ca5d71e8db；新main108f已通知，owner保留已授权完整输入，不reset。现已完整合入main8c57因果修正至base35f0bb9；当前实现targetd47c602已获root整体APPROVED，最终metadata c526c1 clean；03:17实核main3773及origin/main已包含实现d47。


## 唯一来源实际转交：WPF-P01

已只读核验独立tree与三件套，管理nested草案已转移交stub。登记条目：id `WPF-P01`、title `可信Web插件host`、role `工作线`、worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host`、branch `codex/web-plugin-host`、planDir `plans/wpf-p01-plugin-host`、evidenceDir `docs/evidence/wpf-p01`。初始化108f完整main+已审W01 a22ae38，merge0673653ac6b2da8259bc8ca40d9ae723da2ce875；typed接口v1已与消费owner冻结；整体最终实现6ce3ba0 / metadata2910ebc获root APPROVED，PH-R1～4关闭。WPF-I01已经D04v1受领独立新树实际挂载，hostowner保留plugins回修职责，不改App或旧Thread/workspace目录。

D03此前已实证聚合五个平级owner源；新增CHAT/PERF02待主线registry批次后单次核验，现六个nested移交入口不登记。管理者不代写各ownerstatus，字段已分别通知唯一owner补全。


## X01父范围保持开放

主线FLOW-001 full-plan-matrix REQ-11/12/13仍将npm插件install/enable/disable/upgrade/remove、版本配置/能力作用域、trusted/isolated第三方执行、tool/renderer/verifier、CLI等价与未知UI fallback列为X01全栈范围；全栈范围仍未完成；当前X01 canonical已建立，Mika开始X02中心registry首片段，不能继续把下一owner标为全未指定。WPF-P01只关闭可信Web host子验收，不能关闭用户完整plugin系统/所有组件可插拔需求。

接收协调owner为原Execution Lead；X01唯一canonical在plugin-management-plan，X02模块由Mika队唯一owner负责，公共client/export/CLI由ExecutionLead提供。当前Web继续CHAT优先，不抢X02后端或未领取管理UI；未来稳定公共入口后独立claim消费，不宣称全系统完成。


## D04领取迁移：2026-10-06 02:41 UTC实观登记回报

用户U08已逐字存主plan，原Lead确认D04独立树复用dashboard，CLI take/list/release/handoff；PostgreSQL独立工程协调schema/DB仅存分配owner/lead/branch/worktree/scope/version/claim状态。事务检查task与父子路径冲突，receipt后开写，handoff带当前version与明确双方，不自动过期抢占。既有合法M02/P01继续并迁移登记；进度仍各status唯一。我方不实现D04，不把本交接清单当第二claim锁。

以下为两owner实际回传后于02:41 UTC交原Goal Owner/Lead的迁移输入；时间是本次登记，不是倒填开工时间。负责lead为外部Web执行管理d01_owner；登记receipt/后续claim版本由D04唯一权威保存。

**WPF-M02** / workspace_panels_owner / web-unified-workspace / codex/web-unified-workspace，当前active迁移请求：

```text
apps/web/src/App.tsx
apps/web/src/projection.ts
apps/web/src/TaskThread.tsx
apps/web/src/workspace-feed/
apps/web/test/fixture-server.ts
apps/web/test/workspace-projection.test.ts
apps/web/test/workspace-fixture.ts
apps/web/test/workspace-preview.ts
apps/web/test/workspace-browser.ts
apps/web/test/workspace-observers-browser.ts
apps/web/test/workspace-real-center.ts
plans/wpf-m02-web-workspace/
docs/evidence/wpf-m02/
```

明确排除plugins与plugin-host测试。窄屏活动tab若实证确认，另交Lead追加单文件apps/web/src/components/workspace/WorkspacePanels.tsx后再改，不预占整个workspace目录。

**WPF-P01** / w01_owner / web-plugin-host / codex/web-plugin-host，当前active迁移请求：

```text
apps/web/src/plugins/
apps/web/test/plugin-host.test.ts
apps/web/test/plugin-host.browser.ts
apps/web/test/plugin-host.config.ts
plans/wpf-p01-plugin-host/
docs/evidence/wpf-p01/
```

不写App/TaskThread/既有workspace/themes。稳定host提交后明确handoff/cherry-pick交M02挂载；需改host回原唯一owner，或Lead记录显式转交。这里的依赖集成不是两owner同时实施同一路径。

两新树rootlock安装仅已授权本地可逆例外，最终恢复、提供patch给Lead，不能混同共享锁交付ownership。旧W01代码冻结，原owner仅维护后发现与人读status/review元数据（最新3b6c5a39568fa27ca62f1ea45e06a77fb678daee clean）；原broad apps/web写界不继续作为新实现占用。所有后续新take/转交先核dashboard、owner status、liveGit并走Lead登记；缺/旧/冲突不能当空闲。


WPF-M02 WorkspacePanels.tsx追加已获过渡登记c2de313ce5a6f036f07bbfb28d52a7e1a2cc1b9f（02:43:31.089188Z），原Lead明确允许原owner继续局部修复/提交。以上M02精确scope增加该单文件，其余不变；不是PostgreSQL receipt，正式D04迁移后核对origin=migration。新增实际范围不与P01交集，已同步双方。


## WPF-I01 主App插件挂载：准备领取，尚未开写

目的为在固定已审M02与P01输入上实际消费同一typed host，非第二插件协议。root已同意独立feature；拟owner workspace_panels_owner，lead d01_owner，新tree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration`、branch `codex/web-plugin-integration`。现已仅初始化预留树，HEAD c526c1c889437ee39155d669921577995195c74e clean，无安装/文件修改/P01合入；尚未收到I01 claim，不冒称领取有效。主线D04先明确M02已审实现冻结后的相交路径交接，再确认新claim；P01独占plugins继续保留，host修复回原owner。

拟精确scope（主线登记前不写）：

```text
apps/web/src/plugin-integration/
apps/web/src/App.tsx
apps/web/src/TaskThread.tsx
apps/web/src/components/assistant-ui/elements/thread.aui.tsx
apps/web/src/components/workspace/WorkspacePanels.tsx
apps/web/src/themes.ts
apps/web/test/plugin-integration.test.ts
apps/web/test/plugin-integration.browser.ts
apps/web/test/plugin-integration.config.ts
plans/wpf-i01-plugin-integration/
docs/evidence/wpf-i01/
```

`plugins/`与plugin-host专用测试排除；不改shared/backend/rootmanifest/rootlock。fixture可放自有plugin-integration/fixture，不借旧owner测试文件扩scope。若实际需要额外文件先按D04追加，不以目录邻近推定授权。准备计划见[plugin-integration/plan](../../../plans/web-platform/plugin-integration/plan.md)，实施后转stub，正式平级新plan/status由实现owner唯一维护。


02:55迁移/转交进展：实际只读PG receipt文件核验M02 claim dea92c6b-3450-404c-a32c-3fd007485ac6 v1、P01 0686525b-d323-49b5-affa-cefc66cb13be v1；管理claim632a7149-e812-4ddb-b342-99572c554cc5 v2。M02 c526c1 metadata clean已回Lead，三相交路径owner明确停写，等待Lead按v1 amend后I01take；未收到新committed receipt前不得开写。P01整包新输入e534仍复验，旧d810 PH-R3未以旧approval掩盖。初始化I01目录可从c526只读建树满足take实物校验，P01审定后再明确合入。


## D04正式转交完成（2026-10-06 02:58 UTC）

已读取并原样保存[旧scope amend回执](m02-to-i01-amend-receipt.json)与[I01 take回执](i01-take-receipt.json)：requestId分别wpf-m02-stop-three-paths-20261006 / wpf-i01-plugin-integration-20261006。M02 claim dea92c6b-3450-404c-a32c-3fd007485ac6于02:58:05.940Z升v2移出3相交文件；I01 claim b6666c29-ebc5-47b2-b754-55b62687fd00 v1于02:58:06.016Z committed，active精确11scope，lead external_web_d01_owner/worker workspace_panels_owner。此处为原始receipt证据副本，当前version/state仍必须从PG核验，不作为第二可编辑claim账本。

owner已正式收到followup派工：在新tree建立plans/wpf-i01-plugin-integration唯一三件套和docs/evidence/wpf-i01；P01 PH-R4依赖未审定时只做文档与只读接口准备，不安装/merge/写产品。source成立后管理准备stub化并交Lead registry登记。已读采用主仓AGENTS多Lead规则及D04 README；安全source配置不输出，续工核live version/state，未知不当闲置，review修复保留writer范围，任何额外scope须amend receipt。


## WPF-I01唯一进度来源移交

首文档e9dc6904cac949638a993b8f00d0d485a010a1f1，tree/branch已按上节受领且clean，仅8个plan/evidence文件；未安装/合未审P01/改产品。正式source请求已tool交GoalOwner：id WPF-I01、title Web插件主App挂载、worktree /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration、branch codex/web-plugin-integration、planDir plans/wpf-i01-plugin-integration、evidenceDir docs/evidence/wpf-i01。唯一status为新平级目录status.md；管理nested plugin-integration三文件已改stub，不登记第二source。D04claim与进度来源不同：前者已committed，后者已由Lead注册，root03:06:17.755Z实采I01 source/claimv1 matchesSource；未把它当实施通过。


## PERF正式独立领取（2026-10-06 03:07 UTC）

原GoalOwner明确授权外部Lead自助take。管理者先核新web-performance / codex/web-performance实际HEADc526c1c889437ee39155d669921577995195c74e clean与CLI list available无PERFclaim；以stable requestId wpf-perf01-measurement-20261006提交新take，获得[原样committed receipt](perf01-take-receipt.json)：claim4553f315-7fb4-4fe6-babb-0f4a8e5057c6 v1，03:07:10.630Z，lead external_web_d01_owner/worker w01_owner。不是P01amend，不转走其host修复责任。

精确scope为apps/web/test/performance-fixture.ts、apps/web/test/performance-probe.ts、plans/wpf-perf01-web-performance/、docs/evidence/wpf-perf01/；只测量，不写生产代码。owner已正式followup开始本地技能/三件套/有界benchmark，基线是已审M02预I01，不冒称I01最终性能。新canonical status成立后回Lead登记并将管理准备转stub；receipt与实际source聚合分开验。


PERF source移交已落实：首文档c7bf1a81e5d21a602636f388ff565bae1844d83e，management已只读核新树branch/HEAD与唯一status字段。source登记请求：id WPF-PERF01、title Web性能基线测量、worktree /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-performance、branch codex/web-performance、planDir plans/wpf-perf01-web-performance、evidenceDir docs/evidence/wpf-perf01。管理nested performance-cycle已stub；初始实采dirty仅安装产生的根lock变更；管理者曾沿用W01例外解释，随后被GoalOwner明确纠正：PERF四scope不含根lock，不能自动套用历史例外。owner已在本scope保留差异并恢复自身根lock变更；管理者只读核pnpm-lock.yaml/package.json diff为0。root03:12首注册实采已确认PERF源与claim匹配；完整测量尚进行，未做生产优化。

## 保留给用户的产品预览（U09）

原Goal Owner已打开并保留[已审M02预览](http://127.0.0.1:49922/)用户tab；这是HTTP fixture，不能声称真实中心或另起的main3773服务。服务唯一owner workspace_panels_owner，exec session17885，原进程未停止/重启。恢复在 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace`、branch `codex/web-unified-workspace`、metadata `c526c1c889437ee39155d669921577995195c74e`：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/workspace-preview.ts --preview
```

恢复默认动态端口，以stdout真实URL为准，不承诺自动复用49922，不杀其他owner服务。I01 [55049](http://127.0.0.1:55049/)是正在验证的开发fixture（owner exec session79831），不替代已审预览。工程dashboard架构tab已由主线承接，具体唯一[D05 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture/plans/d05-architecture-view/plan.md)已核，交付target仍UNKNOWN，我方仅WPF-D01协作登记。

U10“plugin管理写进计划里”由原Goal Owner逐字转交。主线负责X01 canonical全产品计划，Web管理页/CLI同公共center命令、持久版本/配置/权限/作用域、npm安装启停升级回滚移除、活跃执行版本绑定和信任隔离均属父范围；[X01 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-management-plan/plans/x01-plugin-management/plan.md)已只读核验，文档888308d clean / 产品未实施 / review NOT_STARTED。P01/I01仅可信Web前置，不以本地Settings替代，当前claim不扩大。

已审提交的完整SHA、分支clean状态、恢复方式、检查边界、双主题图和三件套入口汇总于[03:20固定交付快照](delivery-snapshot.md)；它是提交级索引，不是第二进度源。


## 03:37 新canonical登记与共享输入

PERF02唯一source已实际建立并交Execution Lead登记：worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-activity-window`，branch `codex/web-activity-window`，planDir `plans/wpf-perf02-activity-window`，evidenceDir `docs/evidence/wpf-perf02`，首文档c779f86f1bb34ad8143bf35b8b9ca43c9e226758；当前scope内实现dirty、targetUNKNOWN。新claimd36v1 take已可见，尚未新实采source状态卡。旧管理performance-optimization三件套已转stub。

CHAT合同4c2408e4db3595879f6471cb5fffccadec975b3d和public export/client84117ca1c7446ee2e2b50f0526f3460dd42a2869由Lead明确指定依序消费。owner首笔cherry-pick成功bac6a6efe6fa4866bac4d777ee61b703a0e2c7e3，第二笔client/index与contracts/index冲突；保留原现场，不abort/reset，不越scope自行编辑共享。当时ACTIVE阻塞责任ExecutionLead；03:38已通过其精确patch/manifest按before/after hash受控解除，commit a3b9cfaaa4be4ea8b34e6135107b0401f121fbd0。owner可继续自有plan/纯outbox，不能用私有HTTP client解阻或虚称API可编译。

回程路由：Execution Lead ID01a10ea1-f0bb-7622-ad26-db889c131055为另一主task子agent，app工具不能直投；发送至原GoalOwner01a10e15-b908-7a72-b8c0-222a26bf93ff，以“收件人：Execution Lead”标明，由其原样桥接，无额外审批。Mika独立task01a10f3f-4ef0-7ca2-8e66-f1947fa4b295可直联，负责B01后台、下一X02；本队不重复其scope。B01正式性能窗口03:35:16～31已结束（root转报）；Web此段仅功能浏览器，同机正式矩阵下一次先协调。

CHAT唯一canonical实际建立：/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversations，branch codex/web-conversations，planDir plans/wpf-chat01-conversations，evidenceDir docs/evidence/wpf-chat01；首docs c72e02ba55dc4a5b3eddf1cf2a241e33403a0d16 clean / blockerNONE / targetUNKNOWN。已发ExecutionLead登记，旧conversation-core三件套转stub。PERF02与CHAT注册请求已送，不冒称已观测状态卡。


## X02中心registry后继输入（03:44，root只读研究）

固定4054c67cb8a58eaed167df2a82a2d51249afccdc，plugin-registry树的packages/contracts/src/plugins.ts及docs/evidence/x02/interface.md。首片段支持注册、config/grants、精确version选择与operations；runtimeStatus始终unavailable，digest/license为operator声明。configure全替换、select-version清config/grants，Web未来不能显示已安装/已启用/完整rollback成功。请求32KiB、响应64KiB、page40；historical revision与current pointer分开，默认grants空。此为compat调查，不是X02 approval。

REQ40归属不变：Mika写中心模块，ExecutionLead写共享client/export/CLI；待其固定消费入口后Web另领取，不打断CHAT。I01本地可信Settings不等于中心持久插件管理。
