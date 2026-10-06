# K01 版本化手动文本来源

本片提供 owner 可操作的 project 范围手动文本来源、不可变版本、精确原文引用和当前版本词法搜索。完整 REQ-10 hybrid/vector、授权下游消费/摘要失效/MCP/runner 接线仍开放，本片不替代它们。Goal Owner 已批准三表、公共 KnowledgeCitation 和测试 seam，无新增审批。

- [ ] K01-01 固定 DTO、015、migrate/register Interface，交 Lead 接公共入口。
- [ ] K01-02 实现事务来源/CAS/幂等、不可变版本与有界原文引用。
- [ ] K01-03 实现项目当前版本词法检索、短摘要与真实 JSON 预算。
- [ ] K01-04 真实 PG/HTTP 验证并独立 review，记录生产挂载依赖。
- [ ] K01-05 接收 main 事实；真实生产入口验收由 Lead 独立完成。

容量锁定：正文 <=256KiB；project <=128 sources；每 source <=16 retained versions；project retained raw <=64MiB。project 行锁→source 锁→命令幂等锁（operation 含 project/source），同事务插版本/chunks 后切 head；不递增 project.revision。达到容量明确拒绝，不自动删除旧版本。chunk <=4096 UTF8B/至少256B重叠，边界向前对齐、严格推进；每版本至多69块（ordinal0..68），衍生原文字节额外 <=69×4096，与原文总量分别说明。

原文不 trim/NFC，CRLF 原样；拒绝 NUL/不成对 surrogate。引用 project/source/version/digest+半开 UTF8 范围；resolve <=4096B且完整 codepoint，旧版可读并给 isCurrent 快照。版本权威不可变，chunks 可重建投影。

搜索同 REPEATABLE READ snapshot：SQL 内 project+current head 先限定；simple plainto_tsquery 与 strpos 精确 literal 并集；每 source 最佳 chunk 一条，稳定 matchKind/rank/sourceId/ordinal 排序。query<=256B，limit<=20；excerpt<=512B，literal 完整落在摘要内；FTS 摘要可能无全部检索词。search JSON.stringify UTF8 总量<=48KiB，预算截断 hasMore=true，无伪造总数；完整 chunk 仅 resolve。多词跨 chunk 不保证命中，score 不是语义概率。

验证只用实际 createServer({automaticQueueScan:false})+listen 前手工 migrate/register，继承原 owner/runner preHandler；最终生产自动 mount 另验。唯一动态 DB/端口、正常 DROP，0模型/云。先一真实红用例，再最小实现；CAS/ACK/restart/rollback/旧引用/字节/权限/精确词/容量并发/预算用明确小矩阵。固定 Node24/pnpm9.15.4/Vitest4.0.18+noEmit；不跑固定库套件。架构 target 为新 knowledge Interface/3表，Lead 接收后同步共享图。
