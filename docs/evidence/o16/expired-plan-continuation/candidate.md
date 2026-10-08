# 原提案的新阶段确认与两项子任务候选

记录时间：2026-10-08T02:16:41.342Z。**NOT_GRANTED / NOT_RUN**：本文件不是 grant、confirmation、permit 或资源窗口；原 SDK 累计 4 次，当前新增 0 次。

固定实现 `5cf8a5dd529a77f7de054c2ed476cf62213af665`，真实源码摘要 `2d0afdf0757c123e8afaff8f0fc2a3b5b2d08f4c999c94d3417f67f5ccff34aa`，环境摘要 `fc5eb96c84081b60cc65a5bf912bd26f3e8820ca5bf3fcf5e8105001aa439bd8`。本次 exact 7 叶见 [source-delta.json](source-delta.json)，327 输入/39 依赖逆算到原 `e5c7fd9d664de11ab853c55e0a01577c12530555` / `5efa6412123c8134a80759326f8a53572ec9162a6e858dd09581194c5dff83e4`；不复制旧完整闭包。源码/局部结果待独审，真实动态 SQL 和资源接续未执行。

原件来源为 `76a9f36b14c3da1604ee38121f609095cf0cc997` 的 [result-manifest](../native-plan-normal-home-20261008-once/result-manifest.json) 与 [原 pause](../runs/native-plan-normal-home-20261008-once/pause.json)。限定结果独审已 main `254ce9579`（I02 `o16-normal-home-planner-result-intake.json`）。GO 已语义接受 proposal `9a3d0320-efd7-4d65-828c-adb42d6dd5c2` / `fe9b12ce0ef7746c399047633639c7c27ad5fe9f21b82cef60b4a4c4de1e3f7b`；该决定不等于签发 confirmation 或授权 children。

| 阶段 | 请求的准确动作与验收 | 期限及停止边界 |
| --- | --- | --- |
| 新阶段 renew | 请求独立新授权，绑定旧 pause/state/report/resources 摘要、目录 dev/ino/DB marker、当前 source/env、exact7 delta、原 revision1/两节点/不可变 children profile及明确确认理由。唯一新 run 拟为 `native-children-continuation-20261008-once`，尚未创建。仅 `operator.mjs --renew <new-run> <absolute-new-grant>`，0 query，原确认 CAS 返回实际 digest/progressionId 且 admissions=0 才通过。 | 每次原120s工作+30s收尾/150s独立总期限；新grant请求签发后15min有效（校验上限1h不是所请求自动额度）。任何缺证据/未知、旧源已消费、现场变化或关闭失败均停止并保留，不换run或重投。 |
| children | 只有 renew 的真实 ACK、完整资源关闭及新pause仍有效，才签发独立v2 permit，精确绑定实际 confirmationDigest/progressionId、source/env、原两个node/profile和额度。复用 `--children <same-new-run> <absolute-new-permit>`；最多2次 SDK，claude-sonnet-5-5，每次≤3turn、SDK USD0.10、60s。两个固定task各占一次原slot，禁止retry/fallback/换模型/账号或新任务。 | 两次顺序query合用原120s工作+30s收尾/150s总期限；单次60s不延长父期限，耗时不足即失败保留。最大新增SDK估价USD0.20、累计调用≤6；实际费用未知不填0，订阅可见性不等于资格/免费保证。 |
| 独立接受 | 两项真实artifact形成后，独立角色核固定引用、纸鸢/0.1/草稿预览/内部测试四事实、≤120汉字和无编造；须 exact artifact binding、accept/reject 与理由。执行 `--decide <same-new-run> <absolute-decision>` 为0 query；机械关键词验证不能代替独立语义接受。 | children 完整关闭后生成另一份新的15min暂停；接受必须在其内。超时拒绝并保留，不自动延长或复活旧pause。接受操作仍原150s期限。 |

原 `01:45:32.316Z→02:00:32.316Z` 暂停永久保持且旧入口仍拒绝过期；新15min暂停只由新阶段实际成功和资源关闭生成，不覆盖原pause。新阶段的grant/permit时间与审批引用待实际决定，原 `confirmation-draft.json` 的占位理由/旧expiresAt不是授权。

资源保留：旧DB `flow_o16_36ebe1bd4f6343d59ba2e93c61882b92` / marker `1f572164-67bc-4c71-b050-c77b69113a1d`、旧private身份（仅引用原pause，不新读）均KEEP。新阶段新建独立private，状态只写其中；旧material仍按其原绝对路径只读，不复制/改写原journey、凭据、pause/report/resources。原namespace只新增原权威 `pause-consumed-plan.json` 消费记录，和旧入口互斥；不同新run不能绕过同一来源已消费。任何部分写/崩溃留UNKNOWN，不删除消费记录/不回滚旧状态。新private也KEEP；final接受不授DROP或删除两目录。

原资源上界：新private运行材料8MiB；同一新run的operator+stage evidence合计2MiB（跨阶段累计，不能每段重置）。旧private为原封存存量/只读材料，不冒纳入新目录8MiB实测；正常共享HOME/Keychain初始化与刷新在既有同账户权限内，也不冒8MiB保证。原live reserve1GiB与最低start1GiB+128MiB仅模块下限，实际需D01最新完整future floor一次计数；DB/WAL保留与未来增长由真实窗口合并，不能把128MiB称数据库硬cap。原center8+boss3+admin1=PG12，准入需fresh≥28含16余量并关闭probe，renew额外max1只读pool与server错峰关闭；实际容量、身份、old marker/无连接、新namespace/claim与完整输入须在新窗口fresh核。

最前fresh拒绝：公开合同按旧原件重算后，同一受控窗口实际核中心goal/project revision/proposal全input、唯一已完成planner/attempt、两个不可变profile/currentrunner、知识版本、全库无confirmation/progression/application/execution，且来源无in-flight/unknown；开server前再次核。同一SQL只读快照不冒永久排他，实际确认仍依靠原CAS。原4query及旧FAIL/KEEP不动；本片0真实renew/confirmation/PG/auth/native/child。

局部证据见 [validation.json](validation.json)：15不同检查通过，两次FAIL保留，4监督child/6691ms/10595B；最后RETURN `2026-10-08T02:12:06.112396Z`。当前无运行窗口、无pending launch。所需后继只有固定源码独审、GO一次明确新阶段确认+两child预算、D01新资源窗口和当次fresh；不申请再次规划或重跑旧查询。
