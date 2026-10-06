# Web 平台跨 owner 集成清单

2026-10-06 02:15 UTC；这是路径、接口及待集成项登记，进度事实以各唯一status为准。原Execution Lead单独负责集成main、根lock、总索引与4320；我方不修改这些文件/服务。

## Dashboard当前待登记来源

保留主线已有17来源，新增下面3个唯一平级源。每项事实仅来自其planDir/status.md，JSON与网页只派生；管理树nested plugin-system/unified-workspace均已转只读移交stub，不能登记为第二源。

| Task | Worktree | Branch | planDir | evidenceDir |
| --- | --- | --- | --- | --- |
| WPF-001 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management | codex/web-platform-management | plans/web-platform | docs/evidence/web-platform |
| WPF-M02 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace | codex/web-unified-workspace | plans/wpf-m02-web-workspace | docs/evidence/wpf-m02 |
| WPF-P01 | /Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host | codex/web-plugin-host | plans/wpf-p01-plugin-host | docs/evidence/wpf-p01 |

留在管理树的WPF-D01协作/ WPF-PERF01排队文档暂无独立实施源，不能冒称已注册nested目录。2026-10-06T02:31:15.901Z root实际只读4320仍17来源，WPF尚未出现；D03新registry上线后再核对原源保留、3项owner/TODO/source/live HEAD/dirty正确。来源登记不是实现/测试/review或main集成通过。

D03由主线单owner负责紧凑中性视觉及当前阶段/当前工作/下一交付/真正决策、历史下钻、实现review与metadata区分、main与旧SHA区分。WPF-D01只协作需求与来源，不另派实现、不切换4320。每个唯一owner已收到8字段规范，由各自更新，管理者不代写。

## 已交付W01输入边界与版本

| Owner | Worktree / branch | 独占写入 | 依赖与交接 |
| --- | --- | --- | --- |
| w01_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` / `codex/m1-web` | apps/web、plans/w01-web、docs/evidence/w01；workspace子目录在panels提交合入前不并发改 | 官方Thread基于已装assistant-ui0.15.23兼容registry；registry全部精确依赖版本以该树package.json及证据为准。根lock只按原handoff临时安装例外，交patch后恢复，由Lead统一集成 |
| workspace_panels_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-panels` / `codex/web-workspace-panels` | apps/web/src/components/workspace、docs/evidence/w01/workspace-panels | 固定AI Elements源码6a9d5b1822ffb10bba4bd97175f01edd7d8651cd，Apache2.0；ansi-to-react6.2.6与W01统一管理；组件SHA交W01显式cherry-pick复验 |
| d01_owner | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management` / `codex/web-platform-management` | plans/web-platform、docs/evidence/web-platform | 纯管理文档，无生产依赖；固定base d444608ab6c796c731e44e51a892868bf39bec2a |

## 共享能力需求（不在当前W01伪造）

- 现冻结契约仅TimelineEntry text/reference与Detail kind/content/mediaType；无真实PTY会话、stdin/stdout通道、文件目录list/read或可信path。当前UI明确任务输出/任务产物，未来能力由Lead统一contracts/client及权限边界后消费。
- 主线M02提供跨任务工作记录/决策接口SHA与例子后，由W01明确消费接缝；不在Web另造中心命令。
- WPF-P01是X01 Web插件host子项；请求Lead对齐能力ID/权限作用域/API版本/第三方隔离/配置与完整npm生命周期。原P01协议计划不改名、不抢共享接口。
- 原Lead更新plans/README总索引和派工交接，登记WPF-001及三个子计划关系。只有实际实施owner转移时受控修改权威来源，不能任意树的陈旧status覆盖owner。

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

已创建新tree并建立唯一status，管理草案三文件已转移交stub。请Lead/D03增加平级安全源：id `WPF-M02`、title `Web统一工作入口`、role `工作线`、worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-unified-workspace`、branch `codex/web-unified-workspace`、planDir `plans/wpf-m02-web-workspace`、evidenceDir `docs/evidence/wpf-m02`。不聚合旧nested草案。初始化W01 cb4a392+完整M02 e888862合并c0c41f9881713f3b371ba62c8f4e68ca5d71e8db；新main108f已通知，owner保留已授权完整输入，不reset。后续主线无API变更的>200投影补丁待明确SHA。


## 唯一来源实际转交：WPF-P01

已只读核验独立tree与三件套，管理nested草案已转移交stub。登记条目：id `WPF-P01`、title `可信Web插件host`、role `工作线`、worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-host`、branch `codex/web-plugin-host`、planDir `plans/wpf-p01-plugin-host`、evidenceDir `docs/evidence/wpf-p01`。初始化108f完整main+已审W01 a22ae38，merge0673653ac6b2da8259bc8ca40d9ae723da2ce875；具体新实现目标尚UNKNOWN。只读核验人读字段已在新status，完整typed接口尚未落齐，不宣称冻结。主App挂载归M02 owner，hostowner不改App或旧Thread/workspace目录。

D03请仅聚合父WPF-001及两个新的平级owner源；旧nestedM02/plugin入口不登记。管理者不代写各ownerstatus，字段已分别通知唯一owner补全。


## X01父范围保持开放

主线FLOW-001 full-plan-matrix REQ-11/12/13仍将npm插件install/enable/disable/upgrade/remove、版本配置/能力作用域、trusted/isolated第三方执行、tool/renderer/verifier、CLI等价与未知UI fallback列为X01全栈范围；当前未完成，主线队列在D03/G01之后。WPF-P01只关闭可信Web host子验收，不能关闭用户完整plugin系统/所有组件可插拔需求。

接收协调owner为原Execution Lead；下一全栈实施owner由其在D03/G01后有ready槽位、Web host接口/证据可消费且公共权限/隔离输入明确时正式登记。我方已发送ready子项与BR-01接口需求，不擅自占其owner或添加新agent。主线登记后把具体计划/owner/输入SHA补入交接；当前标未指定，不能说全系统已开工或完成。
