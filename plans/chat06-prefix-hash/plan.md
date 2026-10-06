# CHAT06P02 写入摘要的有界返回

编号CHAT06P02；创建/更新2026-10-06；状态in-progress；阶段M2。owner chat06p02_owner / gpt-6-astra，lead Mika。独立worktree assistant-stream-prefix-hash / branch codex/assistant-stream-prefix-hash；base84fdecebbb4939e43710fb17e48884cc49d1d030。

目标：生成中聊天正文仍按完整有序前缀校验SHA-256，但在现有写事务中只从PG返回64字符摘要，避免每个patch把旧正文传回Node重哈希。PG仍完整聚合并哈希，不声称CPU/吞吐/SLO收益。公开readPrefix、final、patch分页和事件/锁/session/offset/revision/replay语义不变；无migration/DTO/SDK/UI/flush修改。

## TODO

- [x] CHAT06P02-01 核固定base、精确claim、技能与测试seam，初始化唯一事实源。
- [x] CHAT06P02-02 真实PG行为红后最小写摘要实现，保留完整校验及公开原文。
- [x] CHAT06P02-03 Unicode/空输入/坏digest回滚/身份幂等及并发行为、直接消费者/noEmit与返回字节证据。
- [ ] CHAT06P02-04 固定实现与原始证据，Mika独立review；Goal Owner接收范围。
- [ ] CHAT06P02-05 Lead main接收核验与停止写入/release。

## 已批准设计与测试seam

saveAssistantStream在现有reportEvents持锁事务中，使用同一SELECT按revision string_agg全部旧text，加$2::text新patch，COALESCE空聚合，convert_to(...,'UTF8')后PG16 sha256(bytea)再encode(...,'hex')。仍严格比较客户端prefixDigest，错误保持stream_digest 409并全事务回滚。私有实现可局部表达，不新增公共helper。

已授权测试seam为真实runner report HTTP、owner block/patch读和PG decoded-return字节观察；行为通过真实写入和读取，不用hash helper自测代替。先一个真实HTTP长prefix case记录查询返回decoded值，要求写校验只有64B digest且owner读回完整；旧实现必须红。随后同独立库覆盖empty prefix/合法empty close、组合字符/nonBMP/CRLF/反斜杠、坏摘要/改旧prefix后续拒绝、错误revision/offset/session、重放和双并发同revision单成功。

专用UUID库创建前拒绝既存，动态port，关闭app→pool→确认本库零连接后正常DROP，保留清理记录；0SDK/provider/model/云。直接consumer选择本模块stream.test.ts既有HTTP/完整读取/最终结算/重放等行为；compatibility.test.ts真实写stream的projection路径按必要性选择。migration未改，旧升级test可仅审影响不机械重跑。所有旧断言保留，必要资源配置只写本evidence harness。Node24/pnpm9.15.4/Vitest4.0.18，显式路径，noEmit。

## 范围与局限

仅store.ts、专用prefix-hash.test.ts与本plan/evidence四scope。P01矩阵不重跑，不扩性能场景；返回字节为decoded UTF8/JSON，不是PG wire或WAL。比较同一已存prefix的旧public read与新write validation返回，记录数据量/查询数，不用时延推导优化倍数。

架构影响为现有store内部写校验的PG/Node职责调整；公共接口/FSM/DB/依赖不变。架构target由Lead在主线接收时按需同步现有assistant-stream内部读取说明，owner不写全局图。

实质进展08:03 UTC：18不同用例=专用10+既有直接消费者8，noEmit0；原9/10/cleanup/types失败保留并修复。8192B旧prefix在同输入行为红中返回8192B，最小改动后64B；当前patch新增SQL参数3B。待固定target与Mika独审，main未接收。
