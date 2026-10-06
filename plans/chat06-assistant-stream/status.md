# CHAT06 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 06:37:30 UTC |
| 单一status owner / model | runner_owner / gpt-6-astra |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/native-assistant-stream |
| Branch | codex/native-assistant-stream |
| 工作基线 / HEAD | base79d6204e4a5781a7041a1545a7424513feaccdae；已合mainacfd；实现5ff8880b3518992121216998c169dd01ab44cee0；metadata后继独立 |
| 工作树dirty状态 | 源码已固定；交付metadata待提交 |
| 工作分支状态 | completed（作者片段；独立review未开始） |
| 检查状态 | PASSED 5ff8880b3518992121216998c169dd01ab44cee0：72/72、tsc、diffcheck；0provider |
| Review | NOT_STARTED，见[review.md](review.md) |
| 已集成main状态 / HEAD | 未集成；base为已审CHAT05分支 |
| 实现目标 | 5ff8880b3518992121216998c169dd01ab44cee0 |
| 实现范围 | packages/contracts/src/assistant-stream.ts,packages/contracts/src/runner.ts,packages/contracts/src/tasks.ts,apps/runner/src/assistant-stream,apps/runner/src/claude.ts,apps/server/src/assistant-stream,apps/server/src/events.ts,packages/storage/migrations/022-assistant-stream.sql |
| 阶段 | M2 |
| 本片段交付阶段 | review |
| 优先级 | 1 |
| 当前产出 | 生成中的正文已可保存与恢复，草稿替换规则等待独立审查 |
| 下一可用交付 | 无需等回答完成，即可读取已保存的文字 |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| CHAT06-01 | completed | runner_owner | 1047→53e→749b正式DTO已交Lead/Web |
| CHAT06-02 | completed | runner_owner | 11 mapper/coalescer行为通过 |
| CHAT06-03 | completed | runner_owner | 19真实PG/HTTP+独立首次022；详见checks-final |
| CHAT06-04 | completed | runner_owner | SDK3状态+ACK2窗口；共72局部/消费者+tsc，0provider |
| CHAT06-05 | in-progress | runner_owner / Lead | 固定5ff8880与manifest，独立review/生产挂载待进行 |
| CHAT06-06 | pending | Lead / Web | conversation尚未交接，本片段不冒称Web交付 |

claim62987833-3fa3-491e-ba0d-21dae383b24c v1，回执[claim-take](../../docs/evidence/chat06/claim-take.json)。已向Lead发canonical供dashboard登记，不修改其他owner状态。新正文流结构待集成时由Lead更新固定架构图。旧CHAT05移交的4文件不再于旧树写入。

## 交付范围与停写

实现5ff8880b3518992121216998c169dd01ab44cee0，证据[README](../../docs/evidence/chat06/README.md)/[manifest](../../docs/evidence/chat06/manifest.json)。250ms/8KiB是合并阈值而非实际首token保证；1MiB限额，未flush尾段非durable。presentation policy明确非provider身份关系，gap/aborted等unavailable。最终72条独立于旧CHAT05的85，不称真实模型/费用/页面验收。liveAssistantText未flip，conversations未改；Lead协调Web先兼容reader/consumer后同批启用与022挂载。所有源码停止写入，claim v1保留独立review回修；不追加dashboard采样。
