# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:11:30 UTC / 2026-10-06 09:11:30 UTC |
| Plan | [plan.md](plan.md) |
| 所属大task | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7 / b88016914c1e880669db7cb39b73f19980489a2e（固定schema/接口；当前HEAD由Git核） |
| 工作树dirty状态 | 仅3scope内本地语义consumer及证据；提交前dirty，提交后由Git核 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | 27/27本地语义检查通过；提交后绑定实现target，真实进程NOT_RUN |
| 已集成main状态 / HEAD | 未集成；最近观察main77c420cf9ee5de0291ea93014b6ea11aead6fab5；注册已入main，consumer未集成 |
| 实现目标 | 未提交 |
| 实现范围 | plans/wpf-mature-02-harness-capabilities, docs/evidence/wpf-mature-02, experiments/codex-app-server-conformance |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | Codex目录与普通完成消息的本地验证模块已实现；支持选项与实际生效保持清晰区别。 |
| 下一可用交付 | 独立审查并接收本地模块，再与统一通信层和会话设置合同组合。 |
| 当前阻塞 | ACTIVE: 真实目录探针仍需验证隔离；本地模块可先审查集成。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，NOT_STARTED |
| 架构影响 | 当前实验不改产品结构；生产host/合同由R05共享owner维护，后继接线需登记架构target。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；仅作者完成，独审未开始 |
| WPF-MATURE-02-03 | blocked | chatui01_owner | 真实进程文件/Keychain/外连隔离尚未证明；未启动，fixture独立继续 |
| WPF-MATURE-02-04 | pending | chatui01_owner | 等R05共享合同与路径交接；当前可继续独立实验 |
| WPF-MATURE-02-05 | pending | d01（Web子任务owner） | 按本大task接口独立交付，尚未获得本task跨端验收证据 |
| WPF-MATURE-02-06 | pending | chatui01_owner | 真实续接/账号/取消恢复未验收 |
| WPF-MATURE-02-07 | in-progress | chatui01_owner | 固定本片提交后交Mika独审，未集成 |
| WPF-MATURE-02-08 | pending | chatui01_owner | 完整目标未验收 |
| WPF-MATURE-02-09 | pending | R05共享owner / d01 | 下一条配置可变与历史/当前/队列冻结分离；CAS/未知ACK/恢复/跨harness，04测量失效，见唯一interface |

## 跨lead接口与handoff

唯一接口请求：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05共享host/main/config/contracts及生产transport/adapter apps/runner/src/codex由ExecutionLead/assignment_review及其runner worker维护；R06 runner_owner独占transport与进程生命周期；本owner仅固定schema/模型事实与已解码实验conformance，Web d01挂本bigplan。当前本owner仅3个独占实验/计划/证据scope，不以方案扩写公共源码。

## Dashboard同步与限制

本status是唯一手填事实源。已只读核main1737cd6a5c8bbb1d5793325ee924802bfbe2a2e9 registry将本task映射到此权威树/status；这不证明4320服务已刷新。claim 0dd97484-f0ce-4738-8075-505bd5e2541a v1 ACTIVE（08:59:56.664 UTC）；无真实app-server/auth/模型/网络执行。目录schema不是账号或模型可用证明；首片不替代整体目标。

## 本片验证与后继

[conformance manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)绑定6源码/README文件、29份固定schema及27项raw。未运行R06组合、真实Codex、账号、模型或Web检查；没有改产品。隔离候选[方案](../../docs/evidence/wpf-mature-02/isolated-run-plan.md)缺canary证据，由Mika审路径后才可能启动。生产架构target归R05/R06，当前仅实验模块，无main运行结构变动。
