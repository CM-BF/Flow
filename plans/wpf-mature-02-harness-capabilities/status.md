# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:39:08 UTC / 2026-10-06 09:34:34 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7 / 7c6e3d835655e1c2c274b71ce0d65225e87172df（一次canary driver；当前HEAD由Git核） |
| 工作树dirty状态 | 语义approval metadata提交后clean；失败证据已提交/push且clean；本次仅跨task review回执、链接与限定诊断事实metadata，提交后由Git核 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | FAILED 7c6e3d835655e1c2c274b71ce0d65225e87172df：一次canary在报告前SIGABRT，七项结果不可用；原语义27项未重跑 |
| 已集成main状态 / HEAD | 未集成；最近观察main80ba95ad70cdf724251be4d88130b6bac56d3606；注册已入main，consumer未集成 |
| 实现目标 | 7c6e3d835655e1c2c274b71ce0d65225e87172df |
| 实现范围 | experiments/codex-app-server-conformance/isolation, docs/evidence/wpf-mature-02/isolation, docs/evidence/wpf-mature-02/isolated-run-plan.md, docs/evidence/wpf-mature-02/interface.md, plans/wpf-mature-02-harness-capabilities |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 一次隔离合成验证在检查报告生成前退出，未证明隔离有效；已确认关闭并清理自有资源。 |
| 下一可用交付 | 审查本次失败证据；后续运行或精确权限变更必须另行审定。 |
| 当前阻塞 | ACTIVE: 合成子进程在报告前异常退出，隔离仍未证实；真实目录探针继续停止。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：静态隔离片APPROVED；一次许可已消费且失败，运行证据待审；语义approval保留 |
| 已审语义片段 | 0d0524c3439363d1fe60aad63f62817ba51fa2a5，27/27行为检查，status_read独审APPROVED，metadata1aead2e；未重新运行/未改source/raw |
| 架构影响 | 当前实验不改产品结构；生产host/合同由R05共享owner维护，后继接线需登记架构target。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；status_read独审APPROVED；未集成 |
| WPF-MATURE-02-03 | blocked | chatui01_owner | 一次合成canary已执行，SIGABRT且无七项报告；关闭确认/自有资源已清理，禁止自动重试 |
| WPF-MATURE-02-04 | pending | chatui01_owner | R05C只读提升final算法回执已交；等待其生产Module正式入口和独审后改薄入口 |
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

[conformance manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)绑定6源码/README文件、29份固定schema及27项raw。未运行R06组合、真实Codex、账号、模型或Web检查；没有改产品。隔离候选[方案](../../docs/evidence/wpf-mature-02/isolated-run-plan.md)缺canary证据，由Mika审路径后才可能启动。生产架构target归R05/R06，当前仅实验模块，无main运行结构变动。

## 隔离后继片段证据

[静态manifest](../../docs/evidence/wpf-mature-02/isolation/manifest.json)独立于已审语义manifest，绑定profile、2脚本、README、bootstrap/R06输入及静态检查。固定R06 a239b14/main e785a29仅复用其唯一transport；当前未运行组合。控制目录保留0700，防止把POSIX只读mode的拒绝误当Seatbelt证据；所有实际macOS边界仍未证。

## 一次运行结果（唯一当前事实）

[运行报告](../../docs/evidence/wpf-mature-02/isolation/canary-run-report.md)与[run manifest](../../docs/evidence/wpf-mature-02/isolation/canary-run-manifest.json)：09:32:21.310Z–09:32:21.558Z，function/factory各一次；DISCONNECTED/SIGABRT，child confirmed-exited，listenerClosed=true，两个已记录根目录不存在。七canary结果均不可用；没有定位具体被拒规则，没有放宽或再次运行。真实Codex/provider/auth均0。旧静态README/manifest保留原准备时点，不替代本段当前运行事实。

## 共享依赖review回执

[Native profile client review](../../docs/evidence/wpf-mature-02/native-profile-client-review.md)仅保存Mika接收的固定095bdb8独审结论，F01进度仍由其权威status维护。此metadata不改变02实现target/27项结果或隔离许可。限定诊断候选三项匹配均false，未读内容；没有新增探测。
