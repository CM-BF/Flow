# WPF-DPERF02 固定交付入口

实现 `902c9b5d35e1795d564c077034dc78cf1a36b6a0`，base `41315b033deb0b1953484359b686c0b228997367`；branch `codex/dashboard-proof-batching`。减少声明范围树证明的重复Git调用，公共Interface不变。[plan](../../../plans/wpf-dashboard-proof-batching/plan.md) / [唯一status](../../../plans/wpf-dashboard-proof-batching/status.md) / [review](../../../plans/wpf-dashboard-proof-batching/review.md)。

- [接口与限制](interface.md)、[验证/失败/样本比较](validation.md)、[quality](quality.md)、[skills](skills.json)
- [固定源绑定](source-binding.json)、[checks](checks.json)、[最终27direct](final-direct.log)
- [baseline](baseline.json)、[after](after.json)、[测量脚本](measure.mjs)；原始baseline-16/64/128与after-16/64/128.trace.jsonl.log同目录（原字节不变，[归档映射](trace-archive-map.json)）
- [root独立27原log](root-independent.log)
- [claim原件](take-receipt.json)、[领取账本](take-ledger.json)

实验已用34.897秒/16.08MB trace完成，**不再执行更多baseline/after**。普通行为复验：`/opt/homebrew/opt/node@24/bin/node --test apps/execution-dashboard/test/proof-tree-batch.test.mjs apps/execution-dashboard/test/proof-snapshot.test.mjs apps/execution-dashboard/test/human-proof.test.mjs`。它仅创建自有临时Git样本；0个人服务/产品DB/模型。

单次128来源ls-tree1920→384、总Git3080→1544；时延9.27→8.10秒仅样本，非生产SLA。source assignment因无DB明确unknown；root已APPROVED；main/deployment尚未完成，未创建预览/新服务。
