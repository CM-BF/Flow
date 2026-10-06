# CHAT06C02 独立审查

状态：NOT_STARTED

- Review target commit：77f0b152a2be32806b17cc7f8a57d33afc2043b3。
- Base commit：a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8。
- Reviewer：待Lead分派；默认只读。
- Scope：同一legacy timeline投影、原rows游标、可选conversation连接协商；排除已审CHAT06领域、公共mount/client、Web/provider。
- 验收：task/events/SSE/workspace无streamID但原DB保留；空页继续、SSE重连；default/unknown/duplicate false、显式ready true；创建ACK和幂等receipt不随header改变。
- 实际检查：8/8局部PG/HTTP+1/1直接消费者（18未选择）及tsc/diffcheck；作者输出不构成独立approval。见[证据](../../docs/evidence/chat06c02/README.md)。
- 复核先核branch/target/dirty与scope，依据公开HTTP及原始证据，不重跑全库/模型。Findings交唯一owner修复；main能力单独记录。

本次scope另含原CHAT06授权test-only delta d9a162738c5c3b3531fc7f5da3a5c0ea1e846e67：公共HTTP不暴露stream ref、PG原记录仍在；不改领域源码。初始fixture/tsc失败输出保留，固定实现全部source及raw见manifest；本次未重跑旧72/全产品，0provider。
