# WPF-MATURE-02 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 10:33:18 UTC / 2026-10-06 10:26:02 UTC（main41315b受控merge944780d已完成） |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-02](plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities |
| Branch | codex/claude-codex-capabilities |
| 工作基线 / HEAD | 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7；受控main41315b / c9c6e891003af2fc52ca77b0c4527d6d85e20e22（目录实现；metadata HEAD由Git核） |
| 工作树dirty状态 | c9c6e891003af2fc52ca77b0c4527d6d85e20e22 clean时核；仅交审metadata更新，提交后由Git核clean |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | review |
| 检查状态 | CATALOG_LOCAL_PASS（33 distinct/strict0，分次证据）；DIAGNOSTIC_COMPLETE / CANARY_FAILED：一次batch2子进程，控制40bytes精确；canary SIGABRT/parent stderr0bytes；282.794417ms、清理完成。原工程检查未重跑 |
| 已集成main状态 / HEAD | R06五源/薄consumer仍待Lead集成；只读main41315b含R05D四源，尚无optional sink；本树已受控合入main41315b |
| 实现目标 | c9c6e891003af2fc52ca77b0c4527d6d85e20e22 |
| 实现范围 | 当前目录精确5文件/局部验证配置/本task计划证据；R06历史5文件已审保持不变 |
| 阶段 | M2 |
| 优先级 | 2 |
| 当前产出 | 原生配置目录已实现并完成局部验证，明确显示Codex尚不支持普通会话；旧目录保持兼容。 |
| 下一可用交付 | 独审原生配置目录；已审共享模块独立排入集成，client接线由共享owner后续完成。 |
| 当前阻塞 | ACTIVE: 原profile canary仍SIGABRT且无有效七项报告，实际Codex目录验证停止；父管道空stderr不能定位原因。 |
| 需用户决定 | NONE |
| Review | [review.md](review.md)：目录c9c6e891 NOT_STARTED；既有R06/薄consumer已审，诊断结果仅faithful FAIL evidence APPROVED |
| 已审语义片段 | 0d0524c3439363d1fe60aad63f62817ba51fa2a5，历史27/27且独审APPROVED；旧manifest/raw不变，final算法副本现由薄入口替代 |
| 架构影响 | 目录Module新增versioned reader/严格DTO，既有挂载与存储不变；R06历史private sink已审，process owner不变。最终target架构更新待Mika/ExecutionLead集成。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-02-01 | completed | chatui01_owner | [领取回执](../../docs/evidence/wpf-mature-02/take-receipt.json)，固定基线/计划/来源登记 |
| WPF-MATURE-02-02 | completed | chatui01_owner | [manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)，27/27本地行为检查；status_read独审APPROVED；未集成 |
| WPF-MATURE-02-03 | blocked | chatui01_owner | 唯一新batch已封存：2child、控制成功、原profile SIGABRT/空stderr，cleanup完成；实际catalog仍blocked，不再启动诊断child；02-04目录实现已独立交审 |
| WPF-MATURE-02-04 | in-progress | chatui01_owner | 已接入独审通过的生产投影，薄入口27/27且独审APPROVED，待集成；[原生配置目录设计](../../docs/evidence/wpf-mature-02/native-catalog-seam.md)已实现首个目录合同/reader/routes并局部验证，c9c6e891待独审；client/Web与共享能力全链路尚未完成 |
| WPF-MATURE-02-05 | pending | d01（Web子任务owner） | 按本大task接口独立交付，尚未获得本task跨端验收证据 |
| WPF-MATURE-02-06 | pending | chatui01_owner | 真实续接/账号/取消恢复未验收 |
| WPF-MATURE-02-07 | in-progress | chatui01_owner | 纯语义固定target已独审通过，待集成；后继隔离片另审 |
| WPF-MATURE-02-08 | pending | chatui01_owner | 完整目标未验收 |
| WPF-MATURE-02-09 | pending | R05共享owner / d01 | 下一条配置可变与历史/当前/队列冻结分离；CAS/未知ACK/恢复/跨harness，04测量失效，见唯一interface |

## 跨lead接口与handoff

唯一接口请求：[interface](../../docs/evidence/wpf-mature-02/interface.md)。R05共享host/main/config/contracts及生产transport/adapter apps/runner/src/codex由ExecutionLead/assignment_review及其runner worker维护；R06 runner_owner独占transport与进程生命周期；本owner仅固定schema/模型事实与已解码实验conformance，Web d01挂本bigplan。初始3个scope之外，现claim v3包含历史5个R06文件与当前5个目录合同/领域文件；当前receipt见native-catalog报告，client/index不在范围。

## Dashboard同步与限制

本status是唯一手填事实源。已只读核main1737cd6a5c8bbb1d5793325ee924802bfbe2a2e9 registry将本task映射到此权威树/status；这不证明4320服务已刷新。claim 0dd97484-f0ce-4738-8075-505bd5e2541a v3 ACTIVE（amend 10:25:51.085 UTC）；无真实app-server/auth/模型/外部网络执行；唯一自有loopback合成运行见下段。目录schema不是账号或模型可用证明；首片不替代整体目标。

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

## 当前诊断准备事实

[诊断报告](../../docs/evidence/wpf-mature-02/diagnostics/README.md)与[manifest-v5](../../docs/evidence/wpf-mature-02/diagnostics/manifest-v5.json)绑定当前source/raw/直接消费者。R06五源已独审通过；driver先前清理不在窗口内的finding已修，根目录和半建sink失败也进入finally，10个真实私有文件/假transport检查通过，待独审。没有真实batch-reservation，没有启动任何新child。受控f181 merge无冲突，integration claim4d035471…已v2 released，writer v2保留。早期v1/v2 manifest及旧许可/失败均为历史，不能重置预算。

当前运行HOLD：S01窗口已结束，本owner仍保持0新child，等待原reviewer复审和Mika单独窗口。driver最终10项包含fsync预算越界回归；文件注明持久化前elapsed，CLI在durableCreate后给最终耗时和withinBudget。

组合review修复：原4e1c989有1 P2（创建根后realpath/lstat失败时漏登记）；当前7297986在创建即登记，未知身份/准备不完整保留。新增6/6故障检查，0listener/0child；旧profile/raw保持固定target，本次仅cleanup变动。

## 唯一新诊断窗口已完成并封存

[运行报告](../../docs/evidence/wpf-mature-02/diagnostics/run-report.md)：10:14:37.579Z起，2factory、第三NOT_RUN，控制40bytes精确，canary SIGABRT/exitCode=null、父stderr收到0bytes。282.794417ms含最终持久化；子进程/listener/三个记录根已关闭或清除。CLI0仅采集/清理成功，隔离仍失败。parent空管道不证明子进程没有错误文字或能写stderr。当前STOPPED，不恢复旧clock/新batch，不重试。旧HOLD/NOT_RUN为历史准备时点，只有本段描述该唯一新运行事实。

## 已审片段独立交付与目录后继

[集成收据](../../docs/evidence/wpf-mature-02/integration-readiness.md)精确区分R06五源0778847、薄入口38516be与失败诊断结果d35c596的approval范围；不复制全局进度，v2写权继续保留。固定f181的versioned native catalog设计属于02-04：复用已发布配置、保留legacy Claude-only和原digest，Codex只configured/not-probed且conversation显式unsupported。无源码amend、工程测试或新child。

只读main41315b相关17目录blob=f181，R05D四源=已审178ef49e；显式配置/可信factory已main，不代表真实启动。目录设计已吸收独立约束，可先实现合同/域reader，client挂载受现writer占用由Lead协调；不是02整task blocker。fd后继候选见interface，当前只读、无额外child/新预算。

目录首片已领取：claim0dd97484…原子amend v3 COMMITTED 2026-10-06T10:25:51.085Z，追加已批五路径；scope[] integration e4f289cf…已v2 released，受控main41315b无冲突merge944780d803ed36deb010d0760f7dd46f75cc3a6f。新合同/reader/routes与局部测试实施中，尚未获得运行通过证据；client/index无写入。

目录首实现已通过33 distinct行为检查与strict0，见[native-catalog报告](../../docs/evidence/wpf-mature-02/native-catalog/README.md)。7合同、9真实PG/HTTP（8先绿+Host修正后1单验）、17旧消费者，所有未选中数/早期setup失败留档。源码交审中，未触client/index、descriptor/runner启动、server/contracts全局index或migration。架构影响为已挂载目录Module新增versioned reader/DTO，待Lead按最终source更新dashboard架构基线；不是实际模型或账户探测。
