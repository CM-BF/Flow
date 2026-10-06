# WPF-MATURE-04 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06T10:25:47.007032+00:00 / main 8d8ab520a9d43c7b9dafb22911416ee799ebf665，6源码未集成；受控合入此固定main已获mika授权 |
| Plan | [plan.md](plan.md) |
| 任务层级 | 大task |
| 大task ID | [WPF-MATURE-04](plan.md) |
| co-lead | mika |
| 单一status owner / model | architecture_read / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency |
| Branch | codex/context-transparency |
| 工作基线 / HEAD | b1c2e39837c2208e6fc2c59a80e16797f26448b5 / Adapter P2修复3ab95d288a91214d03dec719dc6b44024206118a；后继仅本计划/证据metadata |
| 工作树dirty状态 | 核验cd817aff clean与v3 ACTIVE后仅更新自有metadata；6已审源码与各target逐字一致 |
| 工作分支状态 | in-progress |
| 本片段交付阶段 | implementation |
| 检查状态 | PASSED 3ab95d288a91214d03dec719dc6b44024206118a；2显式文件49/49（26 Adapter+23直接projection）、局部root严格noEmit0；[证据](../../docs/evidence/wpf-mature-04/claude-summary.md)，无采集/产品挂载/模型/全库验收 |
| 已集成main状态 / HEAD | 未集成：固定main 8d8ab520a9d43c7b9dafb22911416ee799ebf665 无6源码，879/3ab双target非祖先；[唯一集成输入](../../docs/evidence/wpf-mature-04/integration-readiness.json) |
| 实现目标 | 3ab95d288a91214d03dec719dc6b44024206118a |
| 实现范围 | apps/runner/src/context-observations/claude-summary.ts, apps/runner/src/context-observations/claude-summary.test.ts |
| 阶段 | M2 |
| 优先级 | 1 |
| 当前产出 | 已审规范估算与摘要转换可独立集成；正在实现可追溯的历史样本保存和读取 |
| 下一可用交付 | 历史观测接口与局部读回，明确当前占用及剩余容量未知 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| Review | [review.md](review.md)，当前3ab95d288a91214d03dec719dc6b44024206118a APPROVED，status_read/gpt-6-astra，root于09:28 UTC接收，无剩余P1/P2；旧e81f200 CHANGES_REQUESTED，status_read/gpt-6-astra，1P2/0P1；第一片879c989a594a8f4f266b9a78a885e311c52eca0d仍APPROVED，Mika/gpt-6-astra，09:14:39 UTC |
| Claim | [COMMITTED amend v4](../../docs/evidence/wpf-mature-04/history-amend-receipt.json)，d3a9be2b-6321-49b5-992b-9e3f9f216f49 v4 ACTIVE；仅追加8新history文件，已审6源码冻结 |
| 架构影响 | 原六源码无挂载；新增中心历史record/readLatestHistory与局部GET待固定，沿原事务/fence，无新runner端点；唯一DDL编号与全局挂载由Lead协调，架构视图待集成target更新 |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| WPF-MATURE-04-01 | completed | architecture_read | bbfb7037ee3ca3e37bf14a078f8a05582b209f48已push；7文档/6 TODO/9验收自查通过 |
| WPF-MATURE-04-02 | completed | architecture_read / mika | 879c989a594a8f4f266b9a78a885e311c52eca0d；30/30、局部strict noEmit；Mika独立APPROVED，无P1/P2 |
| WPF-MATURE-04-03 | in-progress | architecture_read / mika | [一页store请求](../../docs/evidence/wpf-mature-04/center-store-request.md)已获mika批准历史首片8新路径；v4已追加；33/33局部合同/HTTP/早拒绝与strict noEmit0；唯一迁移DDL及真实PG待验，当前/remaining/SDK采集仍未知 |
| WPF-MATURE-04-04 | in-progress | architecture_read / runner owner | 纯Adapter P2修复源码已完成，49/49与strict noEmit0，独立APPROVED；不含真实采集、压缩事件或生产接线 |
| WPF-MATURE-04-05 | pending | d01 管理 Web owner | 沿本计划与中心合同消费；未实施 |
| WPF-MATURE-04-06 | pending | architecture_read / mika | 仅schema/纯投影独审已过；完整矩阵与后继独审、main交付未完成 |

## 当前边界与下一步

当前可独立交付已审schema/纯投影与已审Claude summary纯Adapter。后续共享路径协调是co-lead内部工作，本大task无需要GO介入的blocker。不改S01/CHATUI/R05，不运行全库/模型或个人服务，不读取凭据内容。第一片30/30；第二片旧46/46为历史，P2修复49/49覆盖相应模块与直接消费者；provider采集/持久化/权限/重启/Web仍开放。

实现879已独立APPROVED，4文件源码保持固定，等待mika受控集成。后续两文件纯Adapter旧e81f2009153436cacf791aa7c8de492875906586收到1P2，已完成attempt-only修复3ab95d288a91214d03dec719dc6b44024206118a，源码停写并已独立APPROVED，等待mika受控integration；09:16:39 UTC核ledger，09:17:33.927 UTC v3原子amend成功后开写，交付前再次核v3 ACTIVE身份/路径一致，不扩占事件/client/DB/Web。保留claim至明确handoff/release，旧receipt不覆盖后续状态。

02 owner回报的接口固定target为0d0524c3439363d1fe60aad63f62817ba51fa2a5，权威目录claude-codex-capabilities/docs/evidence/wpf-mature-02/interface.md；已纳入next-turn settingsRevision与queued/attempt冻结验收，正式生产字段仍由R05 owner固定，未因此宣称生产设置修改或04观测接线完成。

## Dashboard 同步

本status是WPF-MATURE-04唯一手填事实源。历史登记1737已由mika确认；本轮更新main实际事实为4391bbf9f1785212d098ef6aa1c01a0320a003d3（clean、6源码未集成），不再以登记提交充当当前集成核验。本owner未改registry/计划索引。4320是否部署/采到新源未验证，保留live待采样，不以main注册冒充页面展示或功能集成。

2026-10-06 09:25:10 UTC独立预审绑定e81f200：CHANGES_REQUESTED，status_read/gpt-6-astra，mika接收，1P2/0P1。Query summary仅已有上下文，不能覆盖未发送draft/queued；当前最小修复收窄为有nativeSessionId的attempt，host仍负责已消费input/history cut。历史46/46保留，不算修复后验证。

2026-10-06 09:30:13 UTC：fresh ledger确认v3 ACTIVE、owner/branch/worktree与8scope一致。记录status_read/gpt-6-astra的3ab95d2 APPROVED；原P2已解决，无剩余P1/P2，不重跑测试。后继store共享输入由mika协调，未领取不是本大task整体停止；先把精确小接口整理在自有证据，不扩claim或写生产框架。

2026-10-06 09:31 UTC：只读main3418fe682944145494463dca9e09f89c8b9c2295与ledger，核reportEvents/ownedAttempt/steering revision及共享占用；center-store-request已形成一页请求。未扩claim、未写store/采集框架、未重复工程测试。当前stage仍integration，对应已审两片；后继待scope是内部依赖，不将整个大task标停止。

2026-10-06 09:40:24 UTC：只读确认completed推进last_sequence且随后拒绝新event，原sample.sequence===last_sequence候选不能支持结束后的current。已在一页请求撤回此条件；建议先交历史sample存储，current另依已有result/receipt/seal定义有限可信消费边界，不降完整CT-02/CT-06验收、不造通用FSM。待mika确定最小输入，不扩claim、不测试、不改6源码。

09:40:56 UTC补核main4391的runtime.ts新settlement门禁：unknown不发送completed；确定结束仍在adapter后发送。只读行依据已更新为216/229–230，对accepted completed导致旧等式失效的结论不变；不以没有completed推断上下文未变化。

2026-10-06T10:25:47.007032+00:00：GO优先推进历史保存/公开读回；mika批准8新独立文件与合入固定main 8d8ab520a9d43c7b9dafb22911416ee799ebf665。本轮先固定已审两片integration-readiness，不重跑原检查；后继唯一migration号/owner待Lead，禁止复制临时DDL。当前计划继续推进，不等待Codex，完整current/压缩/Web验收仍开放。

2026-10-06T10:33:41.339595+00:00：固定main8d8已通过scope[] integration受控无冲突合入108d4276298b52911426bba166724298ee3cafdf，未借merge实现；integration claim1de954b3 v2已released。writer v4生效后8新文件实施中；33不同局部用例通过、8根文件继承root严格选项noEmit0，PG/真实owner鉴权/全局事件挂载仍待验。requestedModel保持DB配置alias，resolvedModel独立保留固定host报告，不以二者相等冒充provider验证。新增源码未提交；已审6源不变。
