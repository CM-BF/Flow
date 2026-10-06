# WPF-ATTACH01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 | 2026-10-06 11:32:34 UTC |
| 单一status owner / model | workspace_panels_owner / gpt-6-astra ultra |
| 所属大task | [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md) |
| co-lead | Web /root |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 中心已接收文本附件资源，正式入口可上传并冻结同一材料 |
| 下一可用交付 | 本片段已交付；聊天输入与预览由后继接线 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources |
| Branch | codex/attachment-resources |
| 工作基线 / HEAD | f181d84b5fb3652d62e2a181acff442d42b3e066 / 当前Git聚合 |
| 工作树dirty状态 | 更新前d32a2a2507dc96508479f8d5dd40714c3167e9e0 clean；仅本次main记录，提交后Git核实 |
| 工作分支状态 | completed / approved / main-integrated |
| 本片段交付阶段 | delivered |
| 检查状态 | PASSED 1f0c1966e3cbfef166c58c4aebb7f1aece8c1da9；仅6受影响PG/HTTP case、严格types、4DB清零；本树运行仍legacy fallback；Lead正式factory6项另有归因，旧8701/78保留 |
| 已集成main状态 / HEAD | INTEGRATED fd1322f9c0c1d085d5e343e39f6216b20d26c264；16本方source与23组合source逐字核实 |
| 实现目标 | 1f0c1966e3cbfef166c58c4aebb7f1aece8c1da9 |
| 实现范围 | apps/server/src/attachments/fixture.ts, apps/server/src/attachments/context.test.ts |
| Review | [review.md](review.md)，1f0两文件fixture增量APPROVED；8701 runtime及phase1历史APPROVED另保留 |
| D04 claim | ef617d78-eb39-484e-898e-5f057fca50d4 v2 active，2026-10-06T10:28:42.374Z COMMITTED；十八scope |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-ATTACH01-01 | completed | workspace_panels_owner | [Interface](../../docs/evidence/wpf-attach01/interface.md)、[take](../../docs/evidence/wpf-attach01/take-receipt.json) |
| WPF-ATTACH01-02 | completed | workspace_panels_owner | 运行域实现与作者验证已固定；[原回执](../../docs/evidence/wpf-attach01/runtime-amend-receipt.json) |
| WPF-ATTACH01-03 | completed | workspace_panels_owner | 29项隔离PGHTTP含实际runner/fake adapter；[运行验证](../../docs/evidence/wpf-attach01/runtime-validation.md)，无provider |
| WPF-ATTACH01-04 | completed | workspace_panels_owner | 分层独审与[main接收实核](../../docs/evidence/wpf-attach01/main-observation.json)；Web接线/真实provider保持后继 |

架构影响：新增attachment resources/namespace/bindings与026、项目锁后pin/GC、context v2及private execution输入编排；旧v1不变、CREATE稳定false而GET能力动态。共享mount/client未改；固定架构快照待主线接收后登记target8701a6，owner由管理协调，不越scope写图。唯一source交管理集中登记，未声称dashboard已部署。既有所有预览与个人服务保持不动。

## Handoff

固定phase1实现 6bc2918cf35a652e241e6378c3b6297cac179adb，base f181d84b5fb3652d62e2a181acff442d42b3e066。三源与14个只读依赖hash见[final-checks](../../docs/evidence/wpf-attach01/resource-checks.json)，真实检查源为52317c4+dirty，非事后SHA执行。49项包含真实旧Web投影/queue/client + mock fetch；不是HTTPserver/浏览器/PG或provider验收。

Root兼容裁决：仅请求非空attachments→v2；无附件/[]或原v1 replay永远v1；新client向旧center纯文字必须完全省略attachments。旧loaded Web可读正文/队列但不展示附件；不加Accept/header或GET阻断。runtime与新Web共享decoder仍后继接入。F01已移出conversations.ts、026已预留并在runtime v2精确amend内；indices/client/mount仍不写。

2026-10-06 10:26 UTC：root独立限定APPROVED上述target，独立49/49；类型检查仍作者证据。小合同交管理集中公开输入队列；目前未收到main接收。此为当时phase1边界；10:28 runtime v2已正式amend，后继结果另绑target。

## Runtime安全段

2026-10-06 10:29:57 UTC：原子amend v2已live核18scope。小合同phase1 target6bc2918/metadata339086已独审并交公共队列；当前runtime是新实现段，不能继承49/49/APPROVED。F01/TUI01B indices/client/mount/shareddecoder不写；无provider，后续PG用唯一DB和动态端口，不运行会写旧evidence的测试fixture。

10:39 runtime实质进展：隔离PG+动态HTTP已验证26项，原始失败与修正见quality；继续事务中断和完整局部矩阵。真实provider/个人服务均0调用。

10:46固定runtime交付：target 8701a6cf547248e70aa5758f05da1d7d314ae9c0；[candidate](../../docs/evidence/wpf-attach01/runtime-candidate.json)、[checks](../../docs/evidence/wpf-attach01/runtime-checks.json)、[README复跑](../../docs/evidence/wpf-attach01/README.md)。当时独审NOT_STARTED/main未集成（后续正式结论如下）。当前实现源冻结，仅metadata；原始77/78-first与首失败日志不改，不能混成最终执行事实。

10:49:15 UTC root正式限定APPROVED target8701a6；独立78/78、3自有DB清零，16源码/19只读依赖与两个phase1合同字节核实。独审原[日志](../../docs/evidence/wpf-attach01/root-runtime-direct.log)与[审计](../../docs/evidence/wpf-attach01/root-runtime-audit.json)原样归档；types为作者证据。当前只metadata交付，全部产品源码停止写入、claim保留待main。公共client/decoder/mount、真实App上传与provider均未验，不代表MATURE03整体完成。

## 自动factory测试兼容安全段

仅已领fixture.ts/context.test.ts后继；原8701/78日志不改。live ef617 v2 active核实。真正预026独立库先逐项旧migration与领域操作，再首次完整factory+HTTP；普通和child排空插件注册后严格检查六route，部分挂载失败，完全未挂载才fixture fallback。当前本树server/index仍f181旧factory，自动生产mount未消费/未验。0provider/个人服务，六个受影响case与严格types，独立输出目录，详后继validation。

固定fixture兼容增量 1f0c1966e3cbfef166c58c4aebb7f1aece8c1da9 / base 1d236cbe2299117e3b63887fda3d1c0e140f56b0，只2专测；[验证](../../docs/evidence/wpf-attach01/fixture-compat-validation.md) / [manifest](../../docs/evidence/wpf-attach01/fixture-compat-candidate.json)。6case与4DB清零实际通过；自动factory仍待Lead固定组合，当前观察全部为明确fallback。原runtime8701全16源除这两个测试外不变。

2026-10-06T11:24:06.499649+00:00：root独立APPROVED1f0两文件增量，2选中case/27未选、4DB清零；作者6case/严格types另记。新[累计16源清单](../../docs/evidence/wpf-attach01/runtime-with-fixture-candidate.json)供主线组合，旧runtime-candidate/raw日志不变。当前全部源码冻结，仅metadata归档/正常push；ef617 v2保持active直到正式main receipt。

## 正式main接收

2026-10-06T11:32:34.340491+00:00：只读核固定main `fd1322f9c0c1d085d5e343e39f6216b20d26c264`，本方累计16source与Lead组合23source均与已审manifest相同。详[实核](../../docs/evidence/wpf-attach01/main-observation.json)及原样[Lead组合记录](../../docs/evidence/wpf-attach01/lead-main-attachment-integration.json)。Lead实际6个受影响case通过、23未选、14.62s；8次启动均自动026与六route、无fallback，4DB清零、根types0。上述工程运行归Lead，本owner未重跑78/6/2、无API/服务/模型操作。此前8701/1f0本树fallback记录保持原样；本次正式factory组合不是追改旧证据。真实App附件输入、provider及个人部署仍未验证，不代表MATURE03整体完成。

本次metadata正常commit/push并核clean后，全部18scope停止写入交管理fresh release；此记录时ef617 v2仍active，不提前声称released。架构更新队列可用固定main `fd1322f9c0c1d085d5e343e39f6216b20d26c264`，只记录依赖不越权修改图。

Git核验同时记录：原6bc/8701/1f0/d32a提交均不是该main祖先；这是受控固定源码组合接收，16源字节相等，不声称原分支整段merge。
