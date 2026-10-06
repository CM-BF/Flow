# WPF-MATURE-02 当前诊断driver修复审查

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
