# Current Sandbox syscall67 preparation review

State: APPROVED preparation, status_read/gpt-6-astra, 2026-10-06 12:05:24 UTC; 0 P1/P2. Combination `4dec9500f86ef49495faa499aaf2ef336877de19`, source `f960a1dcc0dccf86c670a00edb2956d8763f9142`. [Recipe](../../docs/evidence/wpf-mature-02/sandbox67/README.md), [input](../../docs/evidence/wpf-mature-02/sandbox67/driver-input.json), [manifest](../../docs/evidence/wpf-mature-02/sandbox67/manifest.json). Independently checked 26 repo/6 external,14 source,25 prepared115530B,archive107167B,9 frozen core and38+41+37 history bindings; eight outputs absent. Fixed selection/one exact67 grant/C same hash/unchanged host;16 fake checks, inert import0,3 syntax0; reviewer reran nothing. Quality's earlier “8 core” counted the subset without config; manifest's full frozen set is9. No isolation/causal approval. Mika has now opened GO's unique go-c-sandbox67-once after this review; owner must commit metadata, verify fresh gate and call the fixed entry once.

# Current C fd v3 result review

State: APPROVED faithful FAIL; architecture_read/gpt-6-astra, 2026-10-06 11:45:46 UTC, 0 P1/P2; Mika accepted. Target `d8038d3ab4b8e58fbe30a19e7135f457eb4cd958`. [Run](../../docs/evidence/wpf-mature-02/fd-canary-v3/run-report.md): 12 result bindings, 31 fixed inputs and 79 old evidence entries match Git/WT/hash/bytes. Fixed d803 archive 123508/131072B; total439216B; receipt+CLI14963/32768B. Parent regular fd identity is not a child observation; profile SIGABRT/no report, file stdio streams=null, zero capture is not evidence of no output. Measurement false, cleanup/accounting true, CLI1. Raw only stat/hash/0600 checked, never read or committed; no tests/child rerun. Automatic evidence is inside runtime clock; manual archive outside time and inside byte budget. No isolation, causal or further-window approval. Later metadata accounting does not alter the d803 snapshot.

# Current C fd v3 combination review

State: APPROVED, architecture_read/gpt-6-astra,2026-10-06 11:38:34 UTC,0P1/P2; Mika accepted. Targeta10b4faedb151805674272e28795fca188639e31/source3636614f3850d7eb9ca63a42c01ea0d95df19db2. [Candidate and fixed bindings](../../docs/evidence/wpf-mature-02/fd-canary-v3/README.md); [new GO request](../../docs/evidence/wpf-mature-02/fd-canary-v3/approval-window-request.md). 31repo Git/WT/SHA/bytes+6external actual hashes,8frozen inputs,30prepared122648B andbaseline101617/131072B verified. Source unchanged after preliminary review;28selected/16unselected,inert Node24 import/3syntax0. v2 41tracked=6b; no new reservation/result/raw. Reviewer reran nothing. Approval covers source/recipe only; current runtime authorizationNONE. NewGO must explicitly accept60s automatic runtime evidence/cleanup/result/CLI, manual review/Git outside time butarchive bytes inside tail.

# Current C fd v2 result review

State: APPROVED faithful incomplete/FAIL, architecture_read/gpt-6-astra,2026-10-06 11:30:14 UTC,0P1/P2; target6b397a584e5b221c63153f843014d31c4118d011. [Run](../../docs/evidence/wpf-mature-02/fd-canary-v2/run-report.md): 13bindings exact; archive6b snapshot130152B/total425695B. Compile1/targets2,profile SIGABRT/no report,third NOT_RUN; measurement false,cleanup/accounting true,CLI1. Raw0600/hash only; no rerun. No isolation/causal approval or proof of all archival work≤60s. Later metadata does not claim old archive hashes are current.

# Current C fd logging/lexer v2 review

State: APPROVED byMika/gpt-6-astra,2026-10-06 11:20:49 UTC,0P1/P2. Fixed target `851fd8c7a48b6ebec64cbf80ccda4eb6bcfaf845`; runtime source checkpoint391f67b42d4ec272ec679a33c0812517afd69090. [Candidate README](../../docs/evidence/wpf-mature-02/fd-canary-v2/README.md), [manifest](../../docs/evidence/wpf-mature-02/fd-canary-v2/manifest.json) SHA224b101fe787ac331507550ea530b4cf6ef1057d836ced71f02700f0b24b4cda, [input](../../docs/evidence/wpf-mature-02/fd-canary-v2/driver-input.json) SHA0b4ca46c82273e88c527ab79e3a35c3e8053180b8221e59c961d243ebd5bea96. 37current repository entries,5unchanged approved sources,38frozen old evidence and6external inputs independently checked Git/WT/hash/bytes, includingprepared104454B;freshclaimv4 ACTIVE/3aeff clean.

Read-only delta review completed: fixedC stdout/stderr≤64KiB/stream,0600/wx/no-follow/fsync beforehealth/parser,copy counted in original2MiB budget,finite failure stage/check andno rawconsole; partialwrite/close/budget/finally behavior; LLVM18.1.8 printArg data-only bounded lexer withquoted executable/bare orquoted args andprecise escaping,unknown exe/output/syntax remain rejected. C/profile/schema,command andR06 unchanged. No new actual compiler/target/provider/auth orunknown→pass.

Final26/26 directly affected checks,9unselected;15new+11existing consumers. Direct Node24 inertimport0 and3syntax checks0. Initial9red andintermediategreen/regression/lexer records remain historical,not extra independent counts orfinal-source evidence. No runtime authorization. Reviewer did not rerun checks/compile/targets orrecover oldraw. [Concrete GO window request](../../docs/evidence/wpf-mature-02/fd-canary-v2/approval-window-request.md) records the new fixed candidate;GO budget approval andMika uniquely named window still required.

# Historical sealed C fd result review

State: APPROVED faithful FAIL byMika/gpt-6-astra,2026-10-06 11:11:14 UTC,target6d1d97581efa9d66019bc30c05fabaed8e672ba0. This is a fixed historical snapshot; later metadata is not claimed to match its archive. See [formal receipt](../../docs/evidence/wpf-mature-02/fd-canary-v2/previous-result-review.md). [Run report](../../docs/evidence/wpf-mature-02/fd-canary/run-report.md), [safe CLI](../../docs/evidence/wpf-mature-02/fd-canary/safe-cli.stdout), [result manifest](../../docs/evidence/wpf-mature-02/fd-canary/run-manifest.json), [actual archive accounting](../../docs/evidence/wpf-mature-02/fd-canary/archive-accounting.json). Window mika-c-fd-20261006-110819 consumed once atclean cdb900d95d26f5a3ee8b35a43805e4212789a683. Compiler exit0/close+group confirmed,0targets;3 NOT_RUN; measurement false/accounting unknown, cleanup true, CLI1. Read-only result review must preserve these distinct facts and actual archive budget; no rerun, raw/crash inspection or inferred isolation/provider success. Fixed result target will be supplied from Git; original source approval below stays scoped.

# Current C fd host combination review

State: APPROVED for the fixed combination. Mika/gpt-6-astra, 2026-10-06 11:07:30 UTC, 0 P1/P2. Fixed target `cf69dddff65d31a821a6c13b984ea0ef6d5fa648`; runtime source checkpoint2b2a37055f2e65c148f543cc9a099fafe9e09085. Independent reviewer Mika/gpt-6-astra completed full entry→host→command/report and20 distinct zero-target evidence review. [Host manifest](../../docs/evidence/wpf-mature-02/fd-canary/host-manifest.json) SHA efcdb353f1f30b8653581ad113637684c32a928ee23795de2ed182575bf9799e;40 repository entries,6 external inputs anddriver prepared evidence list match Git/WT/SHA/bytes in independent review. [Input](../../docs/evidence/wpf-mature-02/fd-canary/driver-input.json) SHA3bea168df09ccf606e587a289e64e8e52b5f6b1caeef2f1d9c05a9128cffd364. [v2 contract/recipe](../../docs/evidence/wpf-mature-02/fd-canary/README.md).

Read-only review completed: verified exact source/entry/toolchain bindings, fixed-clean-HEAD preflight recipe, reservation-before-each-spawn, one compiler/three targets, preserved clang outputs/unknown declarations,20 distinct zero-target evidence, first-stop deadlines/unref, root registration/identity/final inventory,64KiB capture bounds,2MiB preparation/archive/receipt accounting and60-second persistence/CLI gates. No compiler/target/test rerun during review. Scope is only owned fd-canary experiment/evidence; R06 source and722 approved C/schema/profile unchanged. No P1/P2 findings. Actual compile/target count remains0; this approval does not open a runtime window. Fresh claimv4 ACTIVE,792ae27 clean andno reservation were checked at11:07:28 UTC. Owner only records this receipt/status; the final clean metadata HEAD must receive a separately named Mika window.

Historical checks remain bound to original commits: hardened18/18 atb045a546; final-delta4/4 (1new,15unselected) andbudget-delta4/4 (1new,16unselected) at2b2a3705. Native Node24 inert import andfive syntax checks exit0. These do not prove C startup, sandbox isolation or actual provider availability.

# Historical approved C fd candidate source review

State: APPROVED for C/profile/report schema only; fixed target `722032083d2cdfc6790103d18749c333c1b8f9e1`. Independent reviewer architecture_read/gpt-6-astra,2026-10-06 10:48:20 UTC,0P1/P2. All7 manifest entries match target Git/WT/bytes/SHA;3 source files fully read. No compile/test/target run. Execution design/driver/run are excluded; save-temps design delta and an executable host must be independently reviewed before any window. Scope only experiments/codex-app-server-conformance/fd-canary and own fd-canary evidence. [Manifest](../../docs/evidence/wpf-mature-02/fd-canary/manifest.json), [one-page contract](../../docs/evidence/wpf-mature-02/fd-canary/contract.md). Review C immediate result/errno capture, missing stdio/report-fd alias rejection, bounded private five-record output, exact one-literal profile delta, finite three-target gates and all-inclusive output/time/cleanup plan. No compiler/target/driver executed or implemented; source-only review cannot authorize a nonexistent executable host. Root/architecture_read draft suggestions incorporated; frozen implementation needed for final verdict. Old source/raw/manifests untouched.

# Current native configured catalog review

State: APPROVED. Fixed production target `c9c6e891003af2fc52ca77b0c4527d6d85e20e22`. Independent reviewer status_read / gpt-6-astra, 2026-10-06 10:35:37 UTC; Mika accepted after independent hash checks. 0 P1/P2. [Manifest](../../docs/evidence/wpf-mature-02/native-catalog/manifest.json), SHA ce07d9f16ca124746193c207b5616cfe4299c21819216f0d3a97e0344eb4e541: all42 entries (7 source/config,11 readonly inputs,24 raw/receipts) match target Git/WT/SHA/bytes;11 inputs match main41315b. Exact-single native-v1, owner auth and legacy reader, known-pair SQL filtering before LIMIT, strict sentinel/digest, safe409 and conversation cross-checks reviewed; legacy canonical/config digest unchanged.

33 distinct checks are7 contracts + first8 HTTP/PG + corrected Host targeted1 +17 old consumers, not one33/33 run. Strict0. Initial zero-test/setup, oneHTTP and type resolution failures retained. Reviewer did not rerun tests/PG/HTTP or any real Codex/provider. Catalog means configured/not-probed; shared client has not been wired. Production source is ready for independent integration.

Non-blocking P3: fixture set created only after CREATE ACK and could omit its exact owned DB after an unknown ACK. Owner delta now records creationRequested before sending, queries that exact random name during cleanup after closing owned application connections, drops without FORCE, and reports unknown rather than claiming cleanup if lookup/drop/confirmation fails. [Delta evidence](../../docs/evidence/wpf-mature-02/native-catalog/ack-cleanup/README.md): one targeted real-PG commit + synthetic lost-ACK boundary regression passed,9 old cases intentionally not selected, strict0. Production source and original33/raw/manifest remain frozen. Delta review APPROVED by status_read/gpt-6-astra at2026-10-06 10:39:53 UTC, fixed a761941fce5b2b6dd12d8c974c6d2c7e51894628. All14 manifest entries match Git/WT/SHA/bytes;4 unchanged inputs match c9. Original P3 closed,0P1/P2; no reviewer rerun. Following the narrowed Lead request, only store.ts has stopped writing and been removed by v4 amend; the other four catalog paths remain owned. [Partial handback](../../docs/evidence/wpf-mature-02/catalog-store-partial-handback.json).

# Current sealed diagnostic result review

State: APPROVED (honest diagnostic result only; canary FAILED). Result target d35c59682133d77d8581f3c3bce89a4ab3416b26. Source7297986 was independently APPROVED by architecture_read/gpt-6-astra at2026-10-06 10:13:38 UTC: P2 resolved,0remainingP1/P2;78 manifest entries+8 unchanged bindings and input18/external4 matched Git/WT/hashes. Mika authorized exactly one independent window; it has been consumed and sealed.

[Run manifest](../../docs/evidence/wpf-mature-02/diagnostics/run-manifest.json) / [report](../../docs/evidence/wpf-mature-02/diagnostics/run-report.md). Read-only audit of one reservation,2 factory calls, exact control digest, canary failed/SIGABRT/empty parent pipe, null/unknown preservation, all private cleanup, final CLI elapsed after persistence. Do not rerun, open a new batch, inspect raw private diagnostic history or infer isolation fromCLI0.

Mika/gpt-6-astra独立结果复审，2026-10-06 10:17 UTC：APPROVED，仅诊断采集与清理事实。10 safe raw逐SHA/bytes=target Git=WT；input-v5/manifest-v5吻合，运行以来source未变。2factory、282.794417ms、control40bytes精确hash、canary SIGABRT/父管道0bytes/原因unknown；三个精确owned root独立核不存在。CLI0不表示隔离通过；reviewer未重跑工程检查或启动子进程。第三NOT_RUN，不恢复预算。

补充独审：architecture_read/gpt-6-astra，2026-10-06 10:22 UTC，APPROVED faithful FAIL evidence only，无P1/P2。10 safe raw/input/source manifest与复制profile/preload/peer匹配target Git/WT/hash/bytes；control40B/code7、canary SIGABRT/0B/unknown、CLI282.794417ms、cleanup与三个精确根不存在均吻合，未重跑。

已审生产R06五源与实验薄consumer可独立交付，见[集成收据](../../docs/evidence/wpf-mature-02/integration-readiness.md)。claim v2保留，实际main集成由Lead协调；catalog设计属于后继，不扩大本approval。

# WPF-MATURE-02 composition根登记修复复审

状态：APPROVED。Review target commit: 7297986fbc879bb5040879daf97c7d5bb8b657ac。原reviewer architecture_read/gpt-6-astra对4e1c989c0503cc73206d4e3de615e57b881d452e给CHANGES_REQUESTED，Mika接收2026-10-06 10:10:29 UTC，1 P2/0 P1：组合makeRoot创建后才在realpath/lstat成功时登记。

本修复只在mkdtemp成功后立即登记原路径，后续补身份/准备完成状态；realpath/lstat/chmod任意失败保留并报告cleanup-unconfirmed，身份未知或准备不完整不删除。0child/0listener真实临时目录故障6/6通过（3类各覆盖第1/2根）。profile/preload/peer/grants/七项语义未动。R06五源077审批仍有效；19/driver10与C1strict保留原target，不重复运行。当前driver/test只有input selector v4→v5更新，执行输入绑定新compositionhash。

[当前manifest-v5](../../docs/evidence/wpf-mature-02/diagnostics/manifest-v5.json)与[6项raw](../../docs/evidence/wpf-mature-02/diagnostics/composition-preparation.stdout)。无真实batch-reservation，窗口仍HOLD；只读复审后由Mika另给窗口。

# 前一诊断driver审查记录

状态：NOT_STARTED。Review target commit: 4e1c989c0503cc73206d4e3de615e57b881d452e。R06五源seam固定0778847702e595405f6cba0de51c1058b1436504已由Mika/gpt-6-astra独审APPROVED；当前source逐字未变，19/19零child与strict0保留，不重跑。driver原077版本CHANGES_REQUESTED：私有文件清理未含入60秒窗口。修复为同一finally登记/关闭/固定allowlist分类/按inode移除，unknown诚实retained且cleanupComplete=false；首根创建及半建sink失败受覆盖。

[当前manifest-v4](../../docs/evidence/wpf-mature-02/diagnostics/manifest-v4.json)绑定修复、10项零child文件故障/分类检查，以及同树已审C1直接消费者strict0。旧manifest/raw保持历史，不冒称全部重测。只读审预算预留先于spawn、关闭与清理、固定安全标签及保留事实；不要启动driver/真实child/模型。真实窗口未消费，后续须Mika串行安排。

架构范围仅host opt-in diagnostic seam，不允许F01/adapter/env变化，不宣称Seatbelt安全或tools隔离。

# 历史生产投影薄入口审查

状态：APPROVED。Review target commit: 38516be71bf267ab546347a39da2adbe71f79e20。范围仅本task实验final.mjs/README、新生产消费证据与metadata；已审生产源未修改。固定main输入4391bbf9f1785212d098ef6aa1c01a0320a003d3经scope=[] integration receipt合入，无冲突。

[新manifest](../../docs/evidence/wpf-mature-02/production-import/manifest.json)绑定6实验文件、2生产输入和5 raw/receipt文件。唯一一次27/27直接消费者通过，failed/skipped 0；两测试文件未改。只读审单一相对re-export、API保持、生产bytes与已审目标一致、raw及历史manifest边界；不重跑27/31/全库，不启动真实app-server/provider/auth。生产AssertionError安全归一仍为host责任。

独立reviewer Mika/gpt-6-astra，2026-10-06 09:47:22 UTC：APPROVED，无P1/P2。实读完整diff/README/re-export，6 source + 2 production input + 5 raw + 4 historical逐SHA/bytes吻合target Git/WT，errors=[]；catalog/discover/两测试另与0d逐字相同。manifest SHA fbfa4e054a1a1dd28b7bcfeffd4ad2d0221eae27ca247287724319199c3b5f2a。原一次TAP27/27 fail/cancel/skip0与exit0支持直接消费者，reviewer未重跑。仅批准薄入口，不含C1或真实app-server/tools隔离。实际head/dirty与唯一status见[status](status.md)。

# 历史隔离设计审查

状态：APPROVED；仅静态设计可进入一次合成canary，未证明隔离，不批准真实app-server。

Review target commit: e535fc04364c3be4a08ab0c6bc8bebe25afed977。范围：experiments/codex-app-server-conformance/isolation 与 docs/evidence/wpf-mature-02/isolation，以及隔离方案/接口/本计划metadata。Base 9d6bd45abdf5149bc44f1e9dc534454e7403f7d7，R06固定依赖a239b14d5328c78cca02a8757e26f2b65502f926。

核对[manifest](../../docs/evidence/wpf-mature-02/isolation/manifest.json) source/raw与固定commit；逐条审default-deny的路径、Mach/network/exec边界；是否存在宽泛系统读取或macOS未知扩权路径；是否把POSIX拒绝/timeout/refused误计为Seatbelt通过；R06唯一子进程所有权、两个自有目录/loopback资源、未知关闭保留目录、无重试/放宽。不要执行sandbox/profile/canary/真实Codex，不做provider/auth。

作者只执行2项node --check、SBPL括号/必需deny词法检查、链接和旧语义hash复核；这不是SBPL编译/运行证据。已修Mika草稿预审：control目录0700，使创建失败不再可由POSIX只读目录mode单独解释。Mika/gpt-6-astra于2026-10-06 09:28:12 UTC实读profile/2scripts/README/R06 binding与固定options/peer/CloseReport，核8份manifest文件现场与Git完全一致；静态范围APPROVED。允许现scope准备最薄driver并固定source/hash后，只运行一次runSyntheticCanary；失败/未知关闭停止，禁止重试或新增profile grant。

## 已封存语义片段审查（不受后继静态设计冒用）


历史语义状态：APPROVED；仅固定target的纯已解码语义consumer。

Base：9d6bd45abdf5149bc44f1e9dc534454e7403f7d7；Review target commit: 0d0524c3439363d1fe60aad63f62817ba51fa2a5。worktree/branch/status见[status](status.md)。范围为本任务3scope；共享host/中心合同/Web修改不在首片。

## 可复制审查说明

先核AGENTS、skills、实际head/dirty与固定schema provenance。只读核R06 ready后注入request/receive边界、schema版本、model/list页数/大小/未知字段、effort与speed/serviceTier区分、final/失败/取消语义、账户unknown；资源关闭归R06，不是本片工程检查。固定code/raw/hash与实际选中测试数；不要启动真实app-server/provider/auth、不要使用个人凭据。问题给severity/行/场景/影响，修复交owner。任何批准绑定具体commit，不以fixture证明真实账号或跨端完成。

## Findings / 结论

独立reviewer：status_read / gpt-6-astra；Mika接收时间：2026-10-06 09:15:59 UTC。reviewer实读catalog/discover/final及测试，6 source / 1 TAP / 29 schema逐一匹配现场、固定target与0.154冻结归档；无P1/P2阻断发现。仅只读核验，未重跑工程测试。作者27项本地语义检查已通过；[manifest](../../docs/evidence/wpf-mature-02/conformance-manifest.json)绑定source/raw，固定target `0d0524c3439363d1fe60aad63f62817ba51fa2a5`，6 source / 1 raw / 29 schema hash与Git逐一相等。真实运行方案由Mika另审，不由本模板产生许可。

## 通过范围与后继

只批准固定target `0d0524c3439363d1fe60aad63f62817ba51fa2a5` 的纯已解码语义consumer。R06组合、Seatbelt隔离、真实app-server/auth/provider、production与Web均不在approval范围。后继隔离设计单列证据，不改已审语义source/raw/manifest。claim保留，待受控集成。


## 一次运行结果待审（不是静态approval延伸）

Mika已允许的唯一一次runSyntheticCanary由固定driver `7c6e3d835655e1c2c274b71ce0d65225e87172df` 执行。结果[报告](../../docs/evidence/wpf-mature-02/isolation/canary-run-report.md)：09:32:21.310Z–09:32:21.558Z，SIGABRT且无有效canary报告；七项均不能算通过。R06确认退出、listener关闭、两临时根清理；具体bootstrap原因未知。原静态8文件、语义6source/1raw/29schema未改。无自动重试/新grant/真实app-server。运行结果只读复核尚未开始。

当前driver补充修复：4e1c989将最终预算计算移至batch-result持久化之后，文件标before-result-persistence，CLI为外层最终完成证据。10项driver检查含该回归；旧source/raw/manifest均保留历史。S01窗口进行时禁止运行本driver；当前只交源码复审。
