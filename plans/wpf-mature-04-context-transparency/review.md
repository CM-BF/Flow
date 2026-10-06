# WPF-MATURE-04 独立审查记录

状态：NOT_STARTED（当前历史片待真实PG与共享鉴权验证后的最终审查；静态/模块预审无P1/P2）

- Review target commit：a7357c21511a81ca8e603b728c3a24725d7cc140。
- 当前独立预审：Mika / gpt-6-astra，2026-10-06 10:42:39 UTC。无P1/P2静态发现，不批准store/routes生产接入。
- 41项局部合同/确定性query/fixture-auth检查与strict noEmit0已核；真实PG事务、rollback、约束及共享owner-auth待验。
- 原六源码批准及历史修复记录如下保留，不替代当前target最终审查。

# 第二片历史review：3ab95d2修复

状态：APPROVED（3ab95d2 P2修复；旧e81f200的CHANGES_REQUESTED与879的APPROVED均保留）

## 当前修复target

- Target：3ab95d288a91214d03dec719dc6b44024206118a；base：42ab81ea67b5db7a5135802e7e3df6642533ca1f；同branch/worktree与v3 claim。
- 修复scope仅claude-summary.ts/.test.ts两文件，先前已审4源码不变。仅允许带nativeSessionId的attempt；draft/queued/null session拒绝，pending估算留后继独立来源。authenticated host仍负责已消费input/history cut，未加状态机。
- 修后26 Adapter + 23直接projection = 49/49、root局部strict noEmit0；[新manifest](../../docs/evidence/wpf-mature-04/sdk-p2-check.json)及原始日志在同目录；旧46不计修后证据。
- 当前独立reviewer/结论：status_read / gpt-6-astra，APPROVED；root Mika于2026-10-06 09:28 UTC接收，owner于2026-10-06 09:30:13 UTC记录。两源码target/现场/manifest一致，49/49及strict noEmit证据核验；1P2已解决，无剩余P1/P2。
- 批准范围只含本纯Adapter；不覆盖SDK采集、鉴权fence、已消费input/history cut、持久化或生产freshness。此次owner只更新metadata，不重复工程测试。

```text
只读复审3ab95d288a91214d03dec719dc6b44024206118a，base42ab81ea67b5db7a5135802e7e3df6642533ca1f。核branch/head/dirty和新2源码hash，确认旧879四源码不变。核e81f200的P2：SDK Query summary不得覆盖pending draft/queued；修复仅接受subject.kind=attempt且nativeSessionId非空，host消费cut仍外部可信前置。检查默认attempt、三项拒绝、detachment/身份失效及保留的privacy/双窗口/数值边界，结合新49/49与strict noEmit原始证据。禁止provider/Query/auth/安装/个人服务；如需重跑仅同2显式测试路径。不扩范围，给绑定target的P2复审结论与未检查项。
```

作者回应：P2修复已获独立APPROVED，源码冻结等待受控integration；下列旧结论及46项证据保留，不改写历史。

# 第二片历史review：e81f200

状态：CHANGES_REQUESTED（e81f200 Claude summary纯Adapter；第一片879保持APPROVED）

## 当前target与只读交审

- Target：e81f2009153436cacf791aa7c8de492875906586；base：278dba39c80dc38397afbcefee0eca72a85c9cd8；branch codex/context-transparency，权威worktree不变。
- 当前源码scope仅apps/runner/src/context-observations/claude-summary.ts、apps/runner/src/context-observations/claude-summary.test.ts；先前已审4文件diff为空。
- 作者检查：23 Adapter + 23直接projection = 46/46，2显式文件，局部root严格noEmit0；证据见[纯Adapter](../../docs/evidence/wpf-mature-04/claude-summary.md)。合成SDK形状帧，不含真实provider、采集、持久化或Web。
- 独立reviewer/结论：status_read / gpt-6-astra；root Mika于2026-10-06 09:25:10 UTC核两源码Git SHA、现场与预审一致后接收，CHANGES_REQUESTED，1 P2 / 0 P1。
- P2：claude-summary.ts原hostSchema接受draft/queued，estimate无条件full，测试为未发送输入生成current/remaining。getContextUsage只报告Query已消费上下文，响应不证明pending输入被覆盖；该问题阻止本target批准。其余来源/双窗口/边界/privacy预审无P1/P2。

```text
只读review WPF-MATURE-04第二片 target e81f2009153436cacf791aa7c8de492875906586，base278dba39c80dc38397afbcefee0eca72a85c9cd8。先核branch/head/dirty、v3 scope及2新文件hash，确认已审879的4源码不变。读取固定SDK0.3.290证据，核camelCase响应、type-only import、summary-only gate、host冻结身份/resolved mismatch、估算准确度与双窗口、稳定匿名分类/32行边界/安全整数、拒绝缺失或partial截断、无path/name/billing读取，以及Adapter→现公共projection的失效/派生语义。依据46/46和strict noEmit原始记录；如复跑只用显式局部路径。禁止Query/provider/auth/安装/个人服务与共享文件写入。返回绑定target的severity/行号/blocking/结论与未检查项，修复归owner。此片不包含SDK实际采集、中心防自证/持久化/权限/Web完整交付。
```

作者回应/修复：接受P2；仅允许subject.kind=attempt且nativeSessionId非空，draft/queued交后继host-estimator。默认测试输入改为attempt，添加三类拒绝与detachment/身份失效。仅修2个Adapter源码，旧879的4文件不动；修复target与新的局部检查待固定，不用旧46/46冒充修复证据。已审第一片记录如下保留。

# 第一片：已完成独立审查

状态：APPROVED

## Target 与 scope

- Plan：[plan.md](plan.md)；事实源：[status.md](status.md)。
- Review target commit：879c989a594a8f4f266b9a78a885e311c52eca0d；独立reviewer实地核验，不能将模板/作者自查当通过。
- Base commit：b1c2e39837c2208e6fc2c59a80e16797f26448b5。
- Worktree：/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency；branch：codex/context-transparency；reviewer实地核验HEAD57412382724322abff7d21493b09de3d4c554cb1 clean，target后仅5个plan/evidence metadata文件。
- Scope：packages/contracts/src/context-transparency.ts、packages/contracts/src/context-transparency.test.ts、apps/server/src/context-transparency/projection.ts、apps/server/src/context-transparency/projection.test.ts；以及本plan/evidence。独立schema/纯投影已实现，无生产挂载。
- Criteria：完整 CT-01…09、稳定 TODO/status 一致、证据强度和来源、未知语义、R05与共享路径边界、首片不冒充产品交付。
- Reviewer/model/harness/时间：Mika / gpt-6-astra / Codex只读审查 / 2026-10-06 09:14:39 UTC。独立结论由reviewer回传，唯一owner在有效claim内记录。

## 可复制的只读审查任务

```text
只读review WPF-MATURE-04 schema/pure projection，target879c989a594a8f4f266b9a78a885e311c52eca0d。先读根AGENTS.md（modular-design锚点）、plans/AGENTS.md、本目录plan/status及证据。核实际worktree/branch/base/head/dirty，结论绑定具体target。按find-skills本地优先用codebase-design/clean-code，核provider/SDK estimate与derived证据、两窗口、partial/stale/身份失效、next-turn settingsRevision不改queued/attempt、billing隔离、材料/摘要ref与全文边界、limits及4文件scope。作者2文件30/30与局部root严格noEmit有原始证据；如需复跑只用相同受影响路径，不跑全库、provider/auth、安装或个人服务。默认不改文件，给severity/位置/blocking/建议；由owner修复后复审。完整CT-01…09中的持久化/真实来源/页面仍未实现，不以本片通过视完整交付。
```

## 独立步骤与检查

1. 核 commit/branch/dirty/claim 和读写边界。
2. 对照源码固定基线及R05权威分支事实，验证没有把历史/计划当实现。
3. 核完整用户结果、Interface口径、异步失效、权限及引用不重复全文。
4. 核文档链接/TODO/首片交付与完整目标分离。
5. 返回结论及未检查项；owner修复后绑定新target复审。

| 检查 | 执行状态 | target | 结果 |
| --- | --- | --- | --- |
| 独立实现审查 | 已执行，APPROVED | 879c989a594a8f4f266b9a78a885e311c52eca0d | 实读4文件/30项测试及原始证据；4源码SHA与Git/manifest一致 |
| 作者局部行为/noEmit | 已执行，非独审 | 同target，source hashes见manifest | 30/30、noEmit0；不替代review |
| 生产来源/持久化/Web | NOT_RUN | 无挂载 | 本片范围外，不表示通过 |

## Findings 与作者回应

独立结论：无P1/P2，未报告blocking finding。范围为schema与纯投影的来源/estimate/derived、双窗口、partial/stale/identity、next-turn配置不改冻结快照、精确bytes/无全文/上界。

唯一owner回应：源码保持固定target不变。按reviewer要求修正interface-candidate开头“未实现”与下部首片实现事实冲突的metadata表述；首片879已实现，生产挂载/采集/持久化与完整Web仍proposal/未实现。该澄清不是源码修复，不改写已审target。

## 结论与限制

APPROVED，仅绑定879c989a594a8f4f266b9a78a885e311c52eca0d的4文件schema/pure projection。Mika未复跑工程测试，依据固定源码、作者30/30及局部noEmit原始证据作独立review；不审成SDK采集、持久化、权限或Web完整交付，不表示main已集成或4320已部署。后继修改需要按实际scope和target复审。

## 历史持久化/公开读回局部实现（2026-10-06T10:36:04.816805+00:00）

NOT_STARTED。8新文件，41局部用例与严格noEmit0；唯一正式migration尚未分配、真实PG/全局owner auth及events union挂载未验。不得将原879/3ab批准扩展到本片；精确source hash与限制见[history-checks](../../docs/evidence/wpf-mature-04/history-checks.json)。requested模型alias与host resolved独立，current/remaining恒unknown。固定target随后登记，root独审；DB证据必须在正式唯一DDL上补齐。

## 历史片静态/模块预审（2026-10-06 10:42:39 UTC）

Reviewer：Mika / gpt-6-astra。绑定target `a7357c21511a81ca8e603b728c3a24725d7cc140`。根审完整读取新8源与测试，并核[history-manifest](../../docs/evidence/wpf-mature-04/history-manifest.json)的19项（8source/7raw/4support）target Git=WT=bytes/SHA；requested alias与host resolvedModel分离修复成立。无剩余P1/P2静态发现。

这是有界静态/模块预审，**不批准store/routes生产接入**。41不同局部用例=18wire+6DTO+11确定性query consumer+6fixture-auth inject，严格root选项8roots noEmit0；它们不证明真实PG事务、rollback、约束或共享owner-auth hook。根审未复跑工程测试；旧六源批准独立保持。全片正式验收/生产接入仍PENDING，待Execution Lead唯一migration编号/DDL owner及实际验证、共享挂载后复审。没有自占026或扩大producer框架。

作者回应：fresh核65fa04dc clean、v4 ACTIVE，19项再次逐字核固定target；仅记录本结论，源码/raw不变、不重测。唯一DDL/grant到达后立即返回真实PG验证。
