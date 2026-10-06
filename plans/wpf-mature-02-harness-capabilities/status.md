# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:49:29 UTC / 2026-10-06 09:46:53 UTC（固定main输入） |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7 / 38516be71bf267ab546347a39da2adbe71f79e20（薄入口实现；metadata HEAD由Git核） |
| 工作树dirty状态 | 薄入口实现已提交/push且clean；本次approval/诊断方案metadata提交后由Git核 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | integration |
| 检查状态 | PASSED 38516be71bf267ab546347a39da2adbe71f79e20：直接消费者27/27，failed/skipped 0；仅运行一次 |
| 已集成main状态 / HEAD | 生产projection已在已审main 4391bbf9f1785212d098ef6aa1c01a0320a003d3；本实验薄入口尚未集成main |
| 实现目标 | 38516be71bf267ab546347a39da2adbe71f79e20 |
| 实现范围 | experiments/codex-app-server-conformance/final.mjs 与 README；docs/evidence/wpf-mature-02/production-import；本任务metadata |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 实验与生产已共用一份终文判定算法，原有行为检查全部通过且独立审查通过，等待集成。 |
| 下一可用交付 | 集成共享投影薄入口；限定启动诊断方案已提交内部审查。 |
| 当前阻塞 | ACTIVE: 隔离子进程启动原因仍未知，真实目录验证停止；不阻塞薄入口交付。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：当前薄入口APPROVED；历史语义/静态审批各自保留 |
| 已审语义片段 | 0d0524c3439363d1fe60aad63f62817ba51fa2a5，历史27/27且独审APPROVED；旧manifest/raw不变，final算法副本现由薄入口替代 |
| 架构影响 | 实验依赖已审main 4391bbf9f1785212d098ef6aa1c01a0320a003d3 的生产projection单一Module；生产源/FSM/DB未改，生产架构登记归R05C/ExecutionLead。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；status_read独审APPROVED；未集成 |
| WPF-MATURE-02-03 | blocked | chatui01_owner | 一次合成canary已执行，SIGABRT且无七项报告；关闭确认/自有资源已清理，禁止自动重试 |
| WPF-MATURE-02-04 | in-progress | chatui01_owner | 已接入独审通过的生产投影，薄入口27/27且独审APPROVED，待集成；共享能力全链路尚未完成 |
| WPF-MATURE-02-05 | pending | d01（Web子任务owner） | 按本大task接口独立交付，尚未获得本task跨端验收证据 |
| WPF-MATURE-02-06 | pending | chatui01_owner | 真实续接/账号/取消恢复未验收 |
| WPF-MATURE-02-07 | in-progress | chatui01_owner | 纯语义固定target已独审通过，待集成；后继隔离片另审 |
| WPF-MATURE-02-08 | pending | chatui01_owner | 完整目标未验收 |
| WPF-MATURE-02-09 | pending | R05共享owner / d01 | 下一条配置可变与历史/当前/队列冻结分离；CAS/未知ACK/恢复/跨harness，04测量失效，见唯一interface |

## 跨lead接口与handoff

唯一接口请求：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05共享host/main/config/contracts及生产transport/adapter apps/runner/src/codex由ExecutionLead/assignment_review及其runner worker维护；R06 runner_owner独占transport与进程生命周期；本owner仅固定schema/模型事实与已解码实验conformance，Web d01挂本bigplan。当前本owner仅3个独占实验/计划/证据scope，不以方案扩写公共源码。

## Dashboard同步与限制

本status是唯一手填事实源。已只读核main1737cd6a5c8bbb1d5793325ee924802bfbe2a2e9 registry将本task映射到此权威树/status；这不证明4320服务已刷新。claim 0dd97484-f0ce-4738-8075-505bd5e2541a v1 ACTIVE（08:59:56.664 UTC）；无真实app-server/auth/模型/外部网络执行；唯一自有loopback合成运行见下段。目录schema不是账号或模型可用证明；首片不替代整体目标。

## 本片验证与后继

[conformance manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)绑定6源码/README文件、29份固定schema及27项raw。原语义检查未运行R06组合、真实Codex、账号、模型或Web检查；后续唯一合成组合失败另列。隔离候选[方案](../../docs/evidence/wpf-mature-02/isolated-run-plan.md)缺canary证据，由Mika审路径后才可能启动。生产架构target归R05/R06，当前仅实验模块，无main运行结构变动。

## 隔离后继片段证据

[静态manifest](../../docs/evidence/wpf-mature-02/isolation/manifest.json)独立于已审语义manifest，绑定profile、2脚本、README、bootstrap/R06输入及静态检查。固定R06 a239b14/main e785a29仅复用其唯一transport；历史静态时点未运行组合；随后唯一失败运行见下段。控制目录保留0700，防止把POSIX只读mode的拒绝误当Seatbelt证据；所有实际macOS边界仍未证。

## 已封存的一次隔离运行结果

[运行报告](../../docs/evidence/wpf-mature-02/isolation/canary-run-report.md)与[run manifest](../../docs/evidence/wpf-mature-02/isolation/canary-run-manifest.json)：09:32:21.310Z–09:32:21.558Z，function/factory各一次；DISCONNECTED/SIGABRT，child confirmed-exited，listenerClosed=true，两个已记录根目录不存在。七canary结果均不可用；没有定位具体被拒规则，没有放宽或再次运行。真实Codex/provider/auth均0。旧静态README/manifest保留原准备时点，不替代本段当前运行事实。

## 共享依赖review回执

[Native profile client review](../../docs/evidence/wpf-mature-02/native-profile-client-review.md)仅保存Mika接收的固定095bdb8独审结论，F01进度仍由其权威status维护。此metadata不改变02实现target/27项结果或隔离许可。限定诊断候选三项匹配均false，未读内容；没有新增探测。

[TUI01A review](../../docs/evidence/wpf-mature-02/tui01a-review.md)记录2 P2交原owner；[production projection review](../../docs/evidence/wpf-mature-02/production-projection-review.md)仅批准纯投影提升。现共享entry已通过固定main进入本树，薄入口消费证据单列；不复制其他任务进度。

## 当前薄入口交付与诊断后继

[生产消费报告](../../docs/evidence/wpf-mature-02/production-import/README.md)与[新manifest](../../docs/evidence/wpf-mature-02/production-import/manifest.json)绑定当前27项及已审生产输入；旧语义manifest只绑定原0d0524c，不冒充当前wrapper。integration claim76920d8a-459d-4800-9c7b-bcf7e626a16a已v2 released，writer0dd97484-f0ce-4738-8075-505bd5e2541a仍v1 active。

WPF-MATURE-02-03新增独立诊断阶段：最多3次自有合成子进程，总60秒含清理，每次须具体假设或诊断能力变化；旧失败与已消费许可封存。[R06最小seam候选](../../docs/evidence/wpf-mature-02/diagnostic-seam-proposal.md)已提交，待Mika审精确scope与driver后实施，尚无scope amend或新子进程。真实Codex/auth/provider/外网保持0，不扫描私人crash历史，不扩profile。该后继不是薄入口检查的一部分。
