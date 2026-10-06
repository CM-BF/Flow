# WPF-MATURE-02-CORE leaf integration-ready

唯一权威 WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-message-settings-core` / branch `codex/claude-message-settings-core`；owner status_read/gpt-6-astra，co-lead mika，parent WPF-MATURE-02。

- 两个 source 固定 `4e7b7f968a2160a60989b3b6343506ae8fb5ef6a`：`packages/contracts/src/claude-turn-settings.ts`、`packages/contracts/src/claude-turn-settings.test.ts`。没有 index 导出或现有产品文件变更。
- config/raw 固定 `8c56f15c5a70afd4e33031876244f70d1284d957`；原 packet `78c73677438efec7455fc68b44109fa7da9ce5f5`，见 [manifest](manifest.json)。14 Git +4 package 元数据逐项独核。
- [正式独审](independent-review.json)：Mika 15:31:09 UTC、architecture_read 15:31:25 UTC，均 APPROVED/0P1P2。仅本 leaf，不批准下一接线片。
- 实际5 selected/5 passed（6ms）、局部strict0；原raw不重写、不重测；0PG/SDK/provider。配置仅复用既有依赖，本树两源为被测对象，自有cache已清。
- main尚未接收；claim c652bc61 v1保留到明确交接。未来现有source变更仍需fresh amend，不从本批准继承写权。
- 登记 `WPF-MATURE-02-CORE` → worktree `claude-message-settings-core` / planDir `plans/wpf-mature-02-message-settings-core`；唯一[status](../../../plans/wpf-mature-02-message-settings-core/status.md)。不声称已聚合。

下一ready是实际中心到Claude adapter的消息设置接线，只在本证据/plan范围准备设计。leaf不等于大task或端到端能力完成。
