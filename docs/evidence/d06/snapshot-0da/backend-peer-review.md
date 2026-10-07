# D06 5124：backend / PG / runner 独立窄审

结论：**NO_BLOCKING_ASSIGNED_SOURCE_SCOPE / NOT_RUN**。仅本次分工内的事实表述与证据绑定无阻塞；不是整个feature APPROVED，也不是运行、默认启用或个人部署证明。

实现 `5124e6cea1edd3437f765ff67aa13386ae845bfa`，base `6d05ec467581e85d21d5532fd29a2bebd1411b41`，图源固定 `0da869f7bad98771177472539b5a192365c15117`。证据读取固定 metadata `2022ed4352e2d8ac903b6065493626b5853473c5`，观察工作树 clean；没有读取moving源码。data SHA256 `7ccc2ca80760a4050f09a2d7bdbbaf04884395ff945ae0cda887d9d6a1e12d78`；source-proof SHA256 `9ba89a8062643ae9ef7041656d571383110019edf9d77e2ca2eff8e45edc9cb1`。

## 逐项结论（行号属于固定实现 data）

- **028／028–032 factory：14、42、86行。** “已含固定源码”与“Cookie须宿主显式信任配置”、route存在不等启用/完整旅程分开。固定main `apps/server/src/index.ts:101–106,155–156,167–174` 的迁移与route真实存在，174仍在 `options.pluginInstallHost` 条件内。保留HTTP/SSE同授权、GET不续期、退出不cancel事实；没有声称callerOrigin/repeated-connect/迟到Clear-Cookie开放问题已解。14行服务版本只是明确归因Lead回执，本peer未采服务、未将其当0da部署验收。
- **029安装与插件宿主：50、73、93行。** 安装/启用/可调用分开；受控host仅library，X01 37cf仍分支；未冒完整npm依赖、lifecycle、同realm隔离或生产调用。固定main `apps/runner/src/plugins/host.ts:64–86` 先核安装identity/tree，72 load授权、78 invoke授权；abort观察与已执行副作用分开。`plugin-installations/commands.ts:99–131` preparing先提交、session失联unknown的先前精读证据原样复用。没有将“挂载安装route”扩大为生产runner调用。
- **030／031：42、48、54、86行。** reader、owner确认、grant、bounded progression分工准确，configured-readonly/有限授权仍可见。固定main `index.ts:125–139` 复用中心scan生命周期，`goal-progression/advance.ts:9–21,23–55` 限每轮20并复用executeGoalNode，`goal-plan-confirmation/store.ts:17–26,29–75` 原事务/digest/revision事实，均与归档backend报告一致。未承诺TUI确认/授权或完整自然语言自主规划已经接通。
- **032／Claude：19、49、52、84、116行。** 精确声明tuple→中心POST重验→SDK query options，与有限init观察区别正确。既有权限/材料未被描述为绕过。`conversations/message-settings.ts:10–33` 与runner `claude.ts:46–53,71–85,113–119,335–339` 的先前固定精读依据一致。新增116行安全retry保settings重验也复核了 `reconciliation.ts:128` 的 `assertTaskExecutionProfile`；不把requested/init写成每token实际或通用provider热换。
- **历史v2：99行。** 已去掉旧图“attachment-only min1不兼容/mixed未定”的过期结论。固定main `context-transparency/store.ts:78–82` 对一切template2保executionInputDigest、materialRevisionDigest=null、materials unknown/metadata-unavailable；v1仍knowledge-known。当前描述既不把knowledge子集当全量，也不把历史reader未核Web consumer扩大成“Web附件未接”。未声称完整token inventory可用。
- **三未main分支：16、50、62、73行。** S01P07仅新的v2领取恢复未接；原admission/outbox/native并发已main。CHAT05P01仅完整body/chunk后继未接；旧020基础活动已main，旧prefix缺尾仍不能追回。X01明确enable/binding及完整claim/执行后继未接。复用此前固定0da对三个精确ref的非祖先与接口缺失证据：37cf1c28d8dd1e45fe1bb3cadda1c6658aac5f56、83a0799293057f7472f0329c61e566708b2a2381、40af6d9071c621707971fd983a85dd9145f065fd。没有把整个S01/CHAT05标成不存在。

## source-proof 核验与限制

`docs/evidence/d06/snapshot-0da/source-proof.json` 的 fixedMain/productFiles与固定data一致。本次针对相关13个 fixedSourcePins 逐个重新计算Git blob SHA256/bytes，全部与proof一致；归档peer-backend-facts/pins与原两个文件逐字一致，涵盖030/031及branch ancestry。详 audit.json。

相关literal anchors覆盖安装factory条件、host OUTCOME_UNKNOWN、progression20/原executeGoalNode、确认digest/事务、message-settings mismatch/resume拒绝与history v2明确unknown；证明文档自标“limited Python regex anchors only”，不冒JS测试或行为通过。双load/invoke授权及分支非祖先仍由固定源码/peer pins支持，不能由仅命中OUTCOME_UNKNOWN或目录存在推导；候选没有作这种运行性推导。

本次复用本地find-skills/codebase-design/clean-code：沿配置→准入→持久事实→宿主执行职责检查，特别核来源/启用/运行/部署边界与unknown错误语义；未发现本分工的新P1/P2。root负责整体图接口、Web/TUI/工程收据、测试与最终独审，Execution Lead负责集成。0产品运行/Node import/tests/HTTP/PG/Chrome/provider/资源或个人服务采样，未修改任何项目文件。
