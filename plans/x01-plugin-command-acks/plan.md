# X01-PLUGIN-COMMAND-ACK01

所属大task：[X01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding/plans/x01-plugin-management/plan.md)。co-lead Mika；owner db_transaction_owner/gpt-6-astra。创建2026-10-07，accepted/in-progress。

- [x] **X01ACK-01** 复用内部mutation envelope，对configure/set-grants验证实际值、revision、schema与历史receipt；不复制server canonical。
- [x] **X01ACK-02** 现commandPlugin两kind接原transport+冻结请求+未知ACK，保其他两kind旧语义及CLI现捕获。
- [x] **X01ACK-03** 公开client/真正CLI反例、合法大响应、历史replay和原runtime直接消费者局部检查；保失败。
- [ ] **X01ACK-04** 固定独审/主线接收与唯一status，不冒真实PG/Web/provider。

Interface仅新增内部decodePluginRegistryChanged；现commandPlugin签名不变。server既有boundedResponse强制compact成功≤65536；字段保守superset28776B，任意额外空白/代理错误按64KiB/4KiB接收策略。只验证inputDigest64hex，不宣称reason完整摘要匹配。configure必须精确同请求values并合法完整；set-grants精确原数组/声明subset，configurationStatus由required是否存在推导。旧回执按当时revision，不主动GET当前态或重执未知效果。
