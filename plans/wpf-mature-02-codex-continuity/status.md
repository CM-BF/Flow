# MATURE02C02 状态

| 字段 | 当前事实 |
| --- | --- |
| task ID | MATURE02C02 |
| 层级 | 子task |
| 所属大task | [WPF-MATURE-02](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md) |
| co-lead | mika |
| 单一status owner / model | chatui01_owner / gpt-6-astra |
| 最近更新 / 最近main同步核验 | 2026-10-07T04:37:12.466028+00:00；固定main c0e0263dc01b9527293318a644f964bd048e2a86 已核25文件（24旧源加fixture import） |
| 阶段 | M2 |
| 任务开工时间 | UNKNOWN |
| 任务完成时间 | NOT_COMPLETED |
| 任务时间来源 | 历史首次实际开工缺独立明确时点，不用claim/commit/mtime推断；各分段实际时点见证据。 |
| 优先级 | 2 |
| 本片段交付阶段 | implementation |
| 工作分支状态 | in-progress |
| 当前产出 | 持续会话的中心接口、持久宿主配置和主入口已集成；流式内核已审，正在接入来源可辨识的公开正文/公开推理频道与旧客户端协商。真实Codex与产品界面尚未验收。 |
| 下一可用交付 | 已审流式内核可独立集成；当前公开契约/runner持久事件/中心读取/共享投影完成后交独审，Web原owner再据固定v2接入。 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/codex-conversation-continuity |
| Branch | codex/codex-conversation-continuity |
| 工作基线 / HEAD | eae85567ba5dfb650ba71b473917130f87b5945c |
| 工作树dirty状态 | 公开stream实现已固定9e212e50；89项直接行为检查通过；types因历史baseline缺件首失败，精确供给后strict0；独审待固定packet。 |
| HEAD（最近观察） | 2b3b9db8f9a2cf8cf9ebbf85eaa13aad4d3fd599；公开stream source9e212e50已提交；检查与供给补充待本次封存。 |
| claim | 8ad6536b-1194-44a4-9078-a92215bec7a2 v7 ACTIVE，50 literal；fresh读取仍同owner/branch；[精确receipt](../../docs/evidence/mature02c02/public-stream-exports-amend-receipt.json) |
| 实现目标 | 413420a1c0abc76850ab61f8bf67c9d9ac81a494 |
| 实现范围 | packages/contracts/src/execution-profiles.ts, packages/contracts/src/tasks.ts, packages/contracts/src/native-harness.ts, apps/server/src/execution-profiles/store.ts, apps/runner/src/native-harness/descriptor.ts, apps/runner/src/native-harness/codex/adapter.ts, apps/runner/src/native-harness/codex/exchange.ts, apps/runner/src/native-harness/codex/turn.ts, apps/runner/src/native-harness/codex/wire.ts, apps/runner/src/native-harness/codex/index.ts, apps/runner/src/native-harness/codex/session-storage.ts |
| Review | 原source/fixture/local准备与R1失败忠实性均已独审；2026-10-07 03:16:29 UTC architecture_read接受8501d96a R2结果，RESULT_FIDELITY_REVIEW_APPROVED/0P1P2。仅注入transport真实PG/HTTP六组，不扩生产loader/真实native/UI。 status_read 03:30:12Z对519f loader四源与局部结果APPROVED/0P1P2；architecture_read 03:45:14Z对afe3/e836 main SOURCE_AND_LOCAL_RESULT_REVIEW_APPROVED/0P1P2；[本段结果](../../docs/evidence/mature02c02/main-local-result.json)保留strict首失败与fixture路径首失败。 |
| 检查 | 原失败及修后历史记录保留，不重跑旧types/unit。R1 6选5过1失败，旧TMP KEEP。cwd单例1通过/7未选及原Python/ANSI计数错误原件保留。R2单次公开PG/HTTP 6选6过、child/tool exit0，DB/服务/双EOF/组与本次TMP清理确认。0实际Codex/provider/install。 loader focused types0；两直接文件42选41过1失败，端点断言窄修后1过/19未选，共42 distinct；原失败保留。 |
| main集成 | 首片/loader/main已INTEGRATED@c0e0263dc01b9527293318a644f964bd048e2a86；新stream尚NOT_INTEGRATED。 |
| Dashboard | Lead已登记至178来源；本次修正解析字段，等待下一次正常聚合；不改生成JSON。 |
| 架构影响 | 唯一evidence/exchange增加有限私有CodexStreamDelta消费接口；无需新FSM。待独审后由dashboard owner登记固定源码基线；公共source协商属C02-05后继。 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| C02-01 | in-progress | chatui01_owner | [Interface](../../docs/evidence/mature02c02/interface.md)，已实现；新contract/storage反例通过；R1旧目录分页/sentinel等5项真实PG通过，整组失败忠实性已独审通过 |
| C02-02 | in-progress | chatui01_owner | 原单FSM start/resume，7项注入通过；旧post-terminal确定化真实交付反例已通过，收据在fixture-delta-* |
| C02-03 | in-progress | chatui01_owner | 原R1 5/6失败保持；cwd窄修后[R2原六组](../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R2.report.md)单次6/6通过，跨两注入transport/真实PG公开API结果已独审；0真实Codex/provider，heavy已归还 |
| C02-04 | in-progress | chatui01_owner | [loader Interface](../../docs/evidence/mature02c02/loader-interface.md)：四源42 distinct分轮/strict0已独审；main两源已v4领取并接入，固定宿主recipe复用唯一R06；41 distinct分轮、生产focused strict0已独审。详见[main Interface](../../docs/evidence/mature02c02/main-interface.md)。生产R06/CODEX_HOME recipe与持续根生命周期、global remote-status和32/512 stream内核已在本次局部段验证，公开流持久化/读取/界面属C02-05后继；真实两轮另窗。 |
| C02-05 | in-progress | chatui01_owner | 公开stream v2契约、client、中心读及共享投影已合法领取并实施；conversations小harness policy与增量migration、Web/TUI仍未接入，state/replies须消费REQ15批量Interface |

供给唯一入口：[source-request](../../docs/evidence/mature02c02/source-request.json)，291项1548050逻辑B（已供给）；
依赖：[dependency-link-request](../../docs/evidence/mature02c02/dependency-link-request.json)，17已装第三方+3本树@flow，只请求20个ignored links。供给回执已归档 source-provision-receipt.json；owner未安装或自行物化。

检查原件：contract-red-*、continuity-first-*、continuity-green-*、direct-consumers-*、focused-types-first-*。首5文件收据退出码误用日志推断，独立 continuity-first-correction.json 将实际进程退出码标UNKNOWN；50pass只引用Vitest报告，未声称整组成功。

公开API原准备包（历史批准，R1已消费失败）：[固定输入](../../docs/evidence/mature02c02/pg-source-manifest.json) → [资源与接收条件](../../docs/evidence/mature02c02/pg-window-request.md)。源码/metadata准备不占共享PG运行时段。

R1 唯一结果：[报告](../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R1.report.md) → [manifest](../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R1.manifest.json)。原source/claim v2保持，失败根KEEP；Dashboard等待正常聚合本status，无额外运行检查。

本段唯一结果：[cwd-regression-local-result](../../docs/evidence/mature02c02/cwd-regression-local-result.json)。原check-request保留历史NOT_OPEN状态；本段实际授权由Mika→X01→C02 local交接，已结束。0tests Python入口失败与ANSI统计误判分别保留；实际仅运行1例、无重复。工具wait不等整体wall，内部计时与外部退出确认分开。原R1目录保持KEEP。

下一PG唯一输入：[pg-cwd-window-request](../../docs/evidence/mature02c02/pg-cwd-window-request.md) → [新manifest](../../docs/evidence/mature02c02/pg-cwd-source-manifest.json)。302项/4变298不变，0新检查/PG；R2已消费并封存6/6，当前不再开放PG。旧manifest与R1原件不变。

R2 `MATURE02C02-PG-20261007-R2`：2026-10-07 03:12:20–03:12:29 UTC外部包围（保守≤10s），6/6、child/tool0、完整清理；[唯一结果报告](../../docs/evidence/mature02c02/pg-MATURE02C02-PG-20261007-R2.report.md)。旧R1与输入manifest不变，两个窗口互不替代。后继四源已fresh原子amend v3；未借本次执行批准启动真实Codex。

C02-04本地段：≤180s、最多4次有意义定向进程、TMP16MiB、raw256KiB、新source/metadata≤1MiB；直接2测试文件与focused types，无PG/浏览器/provider/真实native。唯一结果[loader-local-result](../../docs/evidence/mature02c02/loader-local-result.json)已固定；3次定向进程、60.95s含修复段、raw24612B，0待launch，已交回X01 local。供给仅本树两缺项11879B+receipt1374B；已有patterns/dirty保留，shared config未改。

C02-04 main 本地段已归还 architecture_read：4定向进程/31.38s内部段，首次strict2→修正0；41选36过5失败（20未选），fixture canonical路径修后5过（56未选），不把61总声明或分轮计成单轮全绿。全部4组final absent/双EOF、10fixture roots与4ownTMP清理确认；raw/artifacts46154B，0待launch。实际native/全stream/production隔离与C02-05未验。REQ15 owner已报告state/replies原子交回，其receipt链接留未来fresh领取；本段没有接管或修改它们。

已审首片/loader/main分别绑定[main-intake](../../docs/evidence/mature02c02/main-intake.json)，已由c0e0263d主线接收，不等于全部C02完成。当前stream普通段预算≤15min/最多6child各45s/TMP16MiB/raw256KiB/source+metadata1MiB，附加预算18087936B已告Mika；SVC06失败保留其自有资源期间，Mika明确准隔离local；fresh组合floor2702442496B通过。新段真实开始由stream-segment登记，不重置task开工。

Stream历史唯一[段记录](../../docs/evidence/mature02c02/stream-segment.json)：6进程分轮；首次104选103过1失败，完整turn fixture修正后1过103未选，104 distinct分轮；types2→0。全部final-owned absent/双EOF/ownTMP同身份清理，0待启动/PG/native/provider。接口与限制见[stream Interface](../../docs/evidence/mature02c02/stream-interface.md)，65c97315独审结果忠实性接受；source曾有1P2，de0f3dc0修后2定向通过/104未选及strict0，04:20:47Z独审关闭。

C02-05下一ready接线：[public-stream-next](../../docs/evidence/mature02c02/public-stream-next.md)。保持既有编号；公开Codex source/channel、中心锁/patch读、shared projection与Web/TUI是完整用户终点。现known共享owner已逐literal登记，未擅取写权。

取消P2修复源de0f3dc0：接收器获得合并signal，取消停止等待且结果unknown，不声明任意sink副作用完成。原段6进程已用尽并归还X01，新增2例/strict0；单记录保原始4进程与后2进程，不称一次106/106。

时钟限制：6个进程及清理在04:18:37完成；897.29s记录早于最终持久化/Git，末tool退出到04:19:36才观察（907s包围），不宣称完整metadata封存也在900s内。无额外运行。

Stream独审status_read 2026-10-07T04:20:47Z APPROVED/0P1P2，原pending-sink P2 CLOSED；[窄intake](../../docs/evidence/mature02c02/stream-intake.json)绑定6源及原检查，不含公开UI。旧片主线接收见[main-acceptance](../../docs/evidence/mature02c02/main-acceptance.json)，root组合首types失败与import修后0均保留，0PG/provider重跑。

公开stream新工作段：已读本地find-skills/codebase-design/clean-code，复用前缀hash封包与单receive pump；一次来源协商/身份策略覆盖runner→中心→共享投影，旧Claude JSON与digest不变。普通local预算每新source段≤300s、最多2必要顶层进程各≤45s，TMP16MiB/raw256KiB/source-meta1MiB；首段2进程结束，输入修复后仅1次types复核；全部组/EOF/ownTMP已确认，local归还X01。每次fresh组合余量；0PG/native/provider/install。Web App/Thread仍RECOVERY原owner，messages renderer另需精确领取；公开reasoning不得映成正文。

当前公开小片：[Interface](../../docs/evidence/mature02c02/public-stream-next.md)与[单段记录](../../docs/evidence/mature02c02/public-stream-segment.json)，source9e212e50/6cbe91ff。89/89仅local真实Node合成transport和注入SQL，后继strict0；原types2保留。v7/50 ACTIVE未release。独立source/results待review，真实PG动态SQL与Web/TUI仍未验；不把旧6PG作为新stream通过。
