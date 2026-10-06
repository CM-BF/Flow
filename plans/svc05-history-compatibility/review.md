# 当前候选兼容结论

Root 独立 `APPROVED_RELEASE03_COMPATIBILITY_EVIDENCE_SCOPED`，绑定后台 af51c621696230fbced12227670f014ca73bd8a1 / Web artifact d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88，报告599a5b170693d2fd154f02302545751afa8cd4222bccaa198ece807b81c28fe9。实际A all12历史证据复用、B3本轮及清理已核，reviewer未重跑，0provider。不是个人部署批准，也不覆盖两保留旧artifact的新后台组合。[原回执](../../docs/evidence/svc05-history-compatibility/release-preparation/web-app1750-independent-review.json)。

以下源码预审/VALIDATION_PENDING均为15:39历史，不是当前兼容结论：

# SVC05H01 独立审查

状态：SOURCE_BINDING / NO_P1_P2，VALIDATION_PENDING；不构成产品兼容或部署批准。先前 cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd 的修复已审是输入；固定旧后台组合与 RELEASE03 新 tuple 尚无本轮批准。

Review target commit：b29807979a5589678a61d3fb84781950cf366396。Base：362af3bac77541e5a60979326bcf4d4b8c947915。

Scope：store.ts 三行 v2 未知投影与精确 attachment-history.test.ts；原完整版本、依赖和 A/B 来源由 manifest 绑定。

独立 reviewer 请核两份源码与来源 blob 相同、其他产品/锁文件零差、原失败保留、依赖仅复用已固定第三方入口且 workspace 绑定本候选、新 tuple 不冒旧 362。测试未获本轮执行授权，不能把 source-only 核验算作兼容通过。默认只读，finding 返回 owner。0 provider，0 个人操作。

Findings：源码预审无 P1/P2；完整 A/B / 本候选四测试 / typecheck 均 NOT_RUN。

## 独立源码组合预审回执

- Reviewer：native_center_owner / gpt-6-astra；时间 2026-10-06T15:37:12.386213Z；独立于作者。
- 固定 target b29807979a5589678a61d3fb84781950cf366396，observed clean HEAD 0037921d12c089e6334b001545f698db067087f8。
- 已完整读 2 源与 15 直接输入；其余产品/依赖/迁移与 362 零差，未发现 P1/P2。0 测试/类型/PG/provider/browser，未把历史已审修复当新组合行为通过。
- 原始回执：[source-precheck.json](../../docs/evidence/svc05-history-compatibility/source-precheck.json)，SHA256 bef82168b40dfd3e7217eaa419141576f5625d2f3a78c4bb6358170f7fb70290。
- 旧 Vitest 测试使用随机库与有界 cleanup，但没有当前资源 statfs 或 DB marker；未来执行须外部窗口/门槛，本预审不授权运行。实际 App tuple、依赖执行、个人部署仍未验。

2026-10-06 15:39 UTC 作者归档；之后只生成 9 个已核第三方入口与 1 个自身 workspace 链接，没有产品改动，没有 import；这项准备不是 A/B 验收。

## 18:07 新的固定搬运候选

artifact-transfer/import-d629.mjs独立源码/文件验证尚NOT_RUN、审查NOT_STARTED；不继承上述af51兼容批准。仅原evidence路径，目标固定d629/10文件，marker/config/lock复用原host，RENAME_EXCL失败无覆盖fallback，失败保留stage/目标/回执。待Lead审源码并批纯文件tiny检查，不执行个人传输。

## 18:14 搬运读取边界修复待独审

Review target commit：91ce18d33a1edf3cd087020ab0ea761579affc63。Lead已完整读f183候选并指出FIFO/成长读P2；作者仅改boundedFile并新增file-only tiny用例，原2red与新8/8已保存。当前状态 REVIEW_PENDING，不以作者green当独审通过；仅该脚本检查，不扩大af51产品兼容或个人部署批准。原manifest保留f183历史，新绑定见[tiny-manifest](../../docs/evidence/svc05-history-compatibility/artifact-transfer/tiny-manifest.json)。

## 18:16 固定搬运准备独立批准

Review target commit：91ce18d33a1edf3cd087020ab0ea761579affc63。Reviewer：Execution Lead / astra_ultra_execution_lead，独立于作者；2026-10-06T18:15:59.838358+00:00，APPROVED。完整脚本与8用例已读，21 source/raw/input/derived hash/bytes核对，无新执行；FIFO与成长读取P2关闭。原2red→8green、red完整test hash未保存等边界保持。

[独立原回执](../../docs/evidence/svc05-history-compatibility/artifact-transfer/independent-review.json)。批准仅固定artifact操作准备与file-only tiny检查，不授权个人搬运/marker/维护/服务；两个retained af51报告、真实Web身份与明确窗口仍是发布前置。source/raw/旧manifest不改，产品af51 tuple不变。

## 单次隔离诊断待独审

Review target commit：d8b4c961b9d36915f07ff4109299fac642566519。按3980已授权提案执行一次，133attempts/exit0，churn NOT_REPRODUCED、容量drop隔离成立，cleanup完整。[固定manifest](../../docs/evidence/svc05-history-compatibility/artifact-transfer/socket-run-manifest.json)。当前REVIEW_PENDING，不继承搬运91ce准备批准、不推个人根因或发布授权。

## 2026-10-06 18:33 UTC：隔离诊断独立结论及恢复准备

Execution Lead独立APPROVED target `d8b4c961b9d36915f07ff4109299fac642566519`，完整2source及40绑定核对；原133次隔离连接、228close、容量drop-beforeHTTP及checkpoint先于清理成立，reviewer未重跑。原件见[独立回执](../../docs/evidence/svc05-history-compatibility/artifact-transfer/socket-independent-review.json)。本批准只覆盖隔离诊断，不证明个人64 CLOSED的原因，不授权扩大cap或任意服务修复。

新同版本Web恢复准备是只读操作证据；[manifest](../../docs/evidence/svc05-history-compatibility/web-recovery/manifest.json)绑定现身份、两类准确backend报告和固定362工具。未执行bootstrap；独立审查与单次窗口待Lead。旧af51产品冻结不变。

2026-10-06 18:37 UTC：同版本恢复准备获Lead独立17固定绑定+52实际输入核验，限定原工具一次bootstrap。已执行原窗口、exit0/ready与前后保护事实由Lead只读确认并恢复main；正式事实见web-recovery/operation-manifest.json和source-window-closed回执。未复跑工程测试，个人64 CLOSED根因仍NOT_PROVEN，新af51发布尚未执行。

## 2026-10-06 18:57 UTC 操作独审与main接收

Execution Lead 独立 APPROVED 固定 `796d6d7df6bb500fdabc43b4b46290a1bc6c0149`；21 fixed/source/raw hash核对、前后保护事实独立比较，reviewer0重跑。原始 false preflight、空白解析纠正、唯一 bootstrap ready、旧 group消失均保留；旧Web收到TERM后的exit1不改作clean0。原[独审回执](../../docs/evidence/svc05-history-compatibility/web-recovery/operation-independent-review.json)限定同版本仅Web恢复忠实性，不证明根因，不授权新发布。

main `888cfd3b1c414b32298661f1fdf5f33bddbe956c` 的21绑定内容逐字相同；原target并非该main祖先，不虚称merge关系。[main receipt](../../docs/evidence/svc05-history-compatibility/web-recovery/operation-main-receipt.json)。未重新探测个人HTTP/服务/数据库。R01已另树领取，不扩大本claim。

## 同版本中心恢复准备（待独立审查）

2026-10-06 19:38 UTC：center-recovery/operator.mjs + facts.mjs仅own evidence实现；固定362工具复用，原产品不改。准备/readonly64表基线已落，操作NOT_RUN。待native_center_owner唯一独审；原网页恢复/发布候选批准不自动扩大到此次恢复。

### 中心恢复期限P2

原独审REQUEST_CHANGES与bindings已归档center-recovery/initial-*。原内部110s回调等fsync后退出且final写在clearTimer后，不能兑现总期限。外层Python subprocess监督从operator启动覆盖reservation至final，超时只kill该child PID。2无服务checks通过（阻塞pipe write与正常返回），真实个人恢复未跑。当前等待native_center_owner唯一增量复审，不自批。

### 期限P2复审及唯一实际恢复

独立native_center_owner APPROVED_PREPARATION source d66bdc41f6f39fbeca93e1bf752bf2729526936e，53绑定与2纯检查核实，P2 CLOSED，0重跑。原报告已归档deadline-independent-review.json。其后Lead明确一次窗口，实际run1945 exit0/2135ms/newcenter74763/8checks全true；操作原始证据等待独立忠实性审查，不作者自批。原center退出原因未知、无新版本发布。
