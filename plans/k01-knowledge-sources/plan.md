# K01 版本化手动文本来源

本片提供 owner 可操作的 project 范围手动文本来源、不可变版本、精确原文引用和当前版本词法搜索。完整 REQ-10 hybrid/vector、授权下游消费/摘要失效/MCP/runner 接线仍开放，本片不替代它们。Goal Owner 已批准三表、公共 KnowledgeCitation 和测试 seam，无新增审批。

- [x] K01-01 固定 DTO、015、migrate/register Interface，交 Lead 接公共入口。
- [x] K01-02 实现事务来源/CAS/幂等、不可变版本与有界原文引用。
- [x] K01-03 实现项目当前版本词法检索、短摘要与真实 JSON 预算。
- [x] K01-04 真实 PG/HTTP 验证并独立 review，记录生产挂载依赖。
- [x] K01-05 接收 main 事实；真实生产入口验收由 Lead 独立完成。
- [ ] K01-06 后继任务继续 REQ-10 hybrid/vector、下游 grant/消费与摘要失效验收；本片交付不关闭该要求。2026-10-07补当前词法查询计划诊断准备，见下节；2026-10-08固定baseline真实诊断完成并获附准入偏差的结果忠实性审查，完整性能/优化与REQ-10验收仍开放。

原已交付片段容量（历史验收保持有效）：正文 <=256KiB；project <=128 sources；每 source <=16 retained versions；project retained raw <=64MiB。project 行锁→source 锁→命令幂等锁（operation 含 project/source），同事务插版本/chunks 后切 head；不递增 project.revision。达到容量明确拒绝，不自动删除旧版本。chunk <=4096 UTF8B/至少256B重叠，边界向前对齐、严格推进；每版本至多69块（ordinal0..68），衍生原文字节额外 <=69×4096，与原文总量分别说明。

原文不 trim/NFC，CRLF 原样；拒绝 NUL/不成对 surrogate。引用 project/source/version/digest+半开 UTF8 范围；resolve <=4096B且完整 codepoint，旧版可读并给 isCurrent 快照。版本权威不可变，chunks 可重建投影。

搜索同 REPEATABLE READ snapshot：SQL 内 project+current head 先限定；simple plainto_tsquery 与 strpos 精确 literal 并集；每 source 最佳 chunk 一条，稳定 matchKind/rank/sourceId/ordinal 排序。query<=256B，limit<=20；excerpt<=512B，literal 完整落在摘要内；FTS 摘要可能无全部检索词。search JSON.stringify UTF8 总量<=48KiB，预算截断 hasMore=true，无伪造总数；完整 chunk 仅 resolve。多词跨 chunk 不保证命中，score 不是语义概率。

验证只用实际 createServer({automaticQueueScan:false})+listen 前手工 migrate/register，继承原 owner/runner preHandler；最终生产自动 mount 另验。唯一动态 DB/端口、正常 DROP，0模型/云。先一真实红用例，再最小实现；CAS/ACK/restart/rollback/旧引用/字节/权限/精确词/容量并发/预算用明确小矩阵。固定 Node24/pnpm9.15.4/Vitest4.0.18+noEmit；不跑固定库套件。架构 target 为新 knowledge Interface/3表，Lead 接收后同步共享图。

首片来源类型固定 manual text；title创建后固定，publish仅新正文。resolve包含同快照currentVersion；引用仍返回指定旧版原文。


## 2026-10-07 留存后继规划（仅metadata授权）

所属大task：[REQ-10](../flow-001-architecture/full-plan-matrix.md)；co-lead Mika；单一owner b01_bounded_reads。基于固定main `c3ba1adfe9374b80a955d45e20310f000fed0310`，原branch不merge/rebase，原K01-01～05/main/31项检查保留，K01-06不关闭。详细输入/方案取舍/未运行验收见[设计证据](../../docs/evidence/k01/retention-design.md)，该文件只解释本计划，不另立权威计划。

- [x] K01-07 核固定基线与真实引用消费者，形成版本身份/留存/固定引用保护的小设计和验收矩阵；独立文档review另记录。
- [ ] K01-08 后续合法产品scope下实现单调身份、真实保留计数、版本保护与有界受控回收；前进migration编号由Lead协调。
- [ ] K01-09 后续合法owner协同接通新旧协议、K02/K03、client/Web及context透明度/history codecs；保持未知回执重试原请求和冻结内容。
- [ ] K01-10 独立专库完成K01-R01～R12的直接行为/并发/预算验证，独立review后受控主线接收；不把规划当已实现。

**本次推荐，未实施：** 身份用JSON number/PG int32正整数，currentVersion作已提交单调高水位；16是实际保留版本数而非编号上限，64MiB/128 sources/256KiB保持有界。原版本全部legacy保守保护；新managed协议区分临时preview/receipt与已持久固定引用。当前head、legacy/unknown、K02/K03内部历史永久保护及外部有界holder不可回收；归档原文仍计容量。只回收经同version锁/FK证明可回收的版本；发布拟定newhead后，确无引用保护的oldhead可成为候选，所有失败保留原head/bytes/receipt。16个durable/legacy/unknown全保护则拒绝，不能承诺旧满源或有限容量下无限发布。

内部保护拟用每version永久标记，外部可释放holder建议每version≤64，不额外积累无限tombstone。配额限制新增占用不能阻断安全释放既有holder；holder使用不可复用pin实例ID，旧release不得影响重新pin的新实例；满额仍可release，掉ACK保持原key/body/协议重放，未知不假称已释放，存储恢复后可继续。本次有界证明只覆盖保留原文/版本/投影/pin元数据；flow.commands原ACK/重放规则不改，其生命周期是实施前需审定的跨模块依赖，不声称整个DB永久有界，也不把4096等终身命令上限作为替代方案。具体schema、协商字段/endpoint、计数索引及前进migration只由后续合法owner落实，当前无产品权限。source identity不删除，历史详情仍读其head；旧citation/digest/冻结正文/执行prompt不重写。

状态所有权保持：knowledge负责原文/身份/保护；K02/K03负责冻结输入与自己的锁，pin在caller事务内向下锁有序version，不能反向再拿project/source；publish/reclaim沿project→source向下。该锁序建议必须用真实竞争测试证明，不能把只读推导当已验。无缺省pin降级、无TTL推定旧引用失效，无通用GC/新broker。

旧客户端/旧中心不得静默切到可回收语义；managed不可回收保证只有pin或内部冻结同事务成立后可声明。需要新能力/协议协商，不能把>16塞入旧v1 history成功DTO或伪报currentVersion16。请求协议选择与body/key一同冻结，send/queue未知ACK重试原请求不变；变协议必须先解决旧未知回执并新建逻辑命令，不能同key改canonical输入，也不能在ACK未知时换新key再次发送。详见设计证据兼容矩阵。

本轮产品验证NOT_RUN；0测试/产品PG/安装/模型/实际历史或留存设置变更。原已交付chunk/raw不可变与保守容量验收继续作为历史事实，不拿新规划覆盖旧验证。

## 2026-10-07 K01-06 查询计划诊断准备

所属大task仍为本K01，REQ-10为需求来源；本段只在原K01-06内细化，不新增并行计划或关闭hybrid/vector。唯一[诊断入口说明](../../docs/evidence/k01/query-plan-diagnostic.md)绑定只读main `3c9345df4aec85a37e8a2a155e079db260d515b1`，复用12词法金样本与project/current、引用、JSON预算和每source winner。先在未来专库观察现MATERIALIZED+literal/FTS的实际EXPLAIN/扫描节点、returned bytes及分离延迟；GIN存在不证明使用。数据量分别声明当前/历史/foreign chunks，不复用17595历史容量数冒充当前扫描。

当前交付仅小诊断方案，产品/PG/工程检查NOT_RUN；后续建议G金样本+D16/D128有界baseline，独立review后再协调合法scope、单独PG窗口与完整入口生命周期。NOT MATERIALIZED/拆分分支只是假设，不调整SQL/pool、不安装扩展或embedding，不承诺提速。原K01-08～10与R01～12、flow.commands实施前依赖保持不变。

2026-10-07 15:01:34 UTC进入原K01-06的20分钟入口准备段，合法amend只新增experiments/knowledge-search。实现说明及计量口径修订收敛在该目录README.md，c2ed设计保持历史原样：自有诊断/admin语句1.5s/lock0.5s，未改factory business10s/pg-boss配置，统一绝对截止与unknown KEEP独立验证。当前仅源准备；四个纯用例与noEmit待资源排他解除，PG/HTTP仍NOT_OPEN，不据此关闭K01-06/08～10。

2026-10-08进展补充：原K01-06固定baseline完成12gold+语义/10EXPLAIN/30timed，限定结果独审见[当前结果入口](../../docs/evidence/k01/query-entry-pg-integrated-20261008-once/results.md)。同call账本偏差保留，不授完全合规PASS；当前SQL未优化，无速度收益结论。正常成功清理已实证，150s失败后独立observer仍仅纯行为证据；历史失败根因不由新PASS证明。此进展不勾选K01-06，不改变K01-08～10/R01～12的NOT_RUN及后继授权边界。
