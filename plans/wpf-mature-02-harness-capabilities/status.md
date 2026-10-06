# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 09:27:57 UTC / 2026-10-06 09:27:57 UTC |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7 / e535fc04364c3be4a08ab0c6bc8bebe25afed977（当前隔离静态设计；后继metadata，实际HEAD由Git核） |
| 工作树dirty状态 | 语义approval metadata提交后clean；隔离设计target已提交；本次仅固定target和共享review回执metadata，提交后由Git核 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | NOT_RUN：隔离片只执行2项JavaScript语法与SBPL词法/链接检查；没有运行sandbox或canary |
| 已集成main状态 / HEAD | 未集成；最近观察maindf29fb511df029a0922ace0f4973f3fe3736e502；注册已入main，consumer未集成 |
| 实现目标 | e535fc04364c3be4a08ab0c6bc8bebe25afed977 |
| 实现范围 | experiments/codex-app-server-conformance/isolation, docs/evidence/wpf-mature-02/isolation, docs/evidence/wpf-mature-02/isolated-run-plan.md, docs/evidence/wpf-mature-02/interface.md, plans/wpf-mature-02-harness-capabilities |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 本地模型语义与隔离静态方案已审，正在固定一次合成验证的输入。 |
| 下一可用交付 | 审查隔离方案后，按明确边界验证自有临时文件与本地连接的拒绝行为。 |
| 当前阻塞 | ACTIVE: 隔离机制尚无运行证据；真实目录探针仍未启动。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：静态隔离片APPROVED可进入一次合成canary；尚未执行；语义approval保留 |
| 已审语义片段 | 0d0524c3439363d1fe60aad63f62817ba51fa2a5，27/27行为检查，status_read独审APPROVED，metadata1aead2e；未重新运行/未改source/raw |
| 架构影响 | 当前实验不改产品结构；生产host/合同由R05共享owner维护，后继接线需登记架构target。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；status_read独审APPROVED；未集成 |
| WPF-MATURE-02-03 | blocked | chatui01_owner | 具体profile/合成canary已准备，仅2项语法检查；静态交审，运行仍NOT_RUN |
| WPF-MATURE-02-04 | pending | chatui01_owner | 等R05共享合同与路径交接；当前可继续独立实验 |
| WPF-MATURE-02-05 | pending | d01（Web子任务owner） | 按本大task接口独立交付，尚未获得本task跨端验收证据 |
| WPF-MATURE-02-06 | pending | chatui01_owner | 真实续接/账号/取消恢复未验收 |
| WPF-MATURE-02-07 | in-progress | chatui01_owner | 纯语义固定target已独审通过，待集成；后继隔离片另审 |
| WPF-MATURE-02-08 | pending | chatui01_owner | 完整目标未验收 |
| WPF-MATURE-02-09 | pending | R05共享owner / d01 | 下一条配置可变与历史/当前/队列冻结分离；CAS/未知ACK/恢复/跨harness，04测量失效，见唯一interface |

## 跨lead接口与handoff

唯一接口请求：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05共享host/main/config/contracts及生产transport/adapter apps/runner/src/codex由ExecutionLead/assignment_review及其runner worker维护；R06 runner_owner独占transport与进程生命周期；本owner仅固定schema/模型事实与已解码实验conformance，Web d01挂本bigplan。当前本owner仅3个独占实验/计划/证据scope，不以方案扩写公共源码。

## Dashboard同步与限制

本status是唯一手填事实源。已只读核main1737cd6a5c8bbb1d5793325ee924802bfbe2a2e9 registry将本task映射到此权威树/status；这不证明4320服务已刷新。claim 0dd97484-f0ce-4738-8075-505bd5e2541a v1 ACTIVE（08:59:56.664 UTC）；无真实app-server/auth/模型/网络执行。目录schema不是账号或模型可用证明；首片不替代整体目标。

## 本片验证与后继

[conformance manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)绑定6源码/README文件、29份固定schema及27项raw。未运行R06组合、真实Codex、账号、模型或Web检查；没有改产品。隔离候选[方案](../../docs/evidence/wpf-mature-02/isolated-run-plan.md)缺canary证据，由Mika审路径后才可能启动。生产架构target归R05/R06，当前仅实验模块，无main运行结构变动。

## 隔离后继片段证据

[静态manifest](../../docs/evidence/wpf-mature-02/isolation/manifest.json)独立于已审语义manifest，绑定profile、2脚本、README、bootstrap/R06输入及静态检查。固定R06 a239b14/main e785a29仅复用其唯一transport；当前未运行组合。控制目录保留0700，防止把POSIX只读mode的拒绝误当Seatbelt证据；所有实际macOS边界仍未证。
