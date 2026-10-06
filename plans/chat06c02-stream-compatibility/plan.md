# CHAT06C02 正文流公共兼容

状态：in-progress。Owner runner_owner / gpt-6-astra。2026-10-06 06:47 UTC。
工作基线 a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8；已审CHAT06 final1a4c63c受控合入，86fc公共boolean合同作为依赖单独cherry-pick。GO已批准本次有界设计，0模型。

旧timeline输出统一排除typed assistant-stream引用，底层事件与正文不删除。所有cursor/hasMore使用原始rows计算，过滤后空页仍前进，SSE可重连。任务快照、事件页、workspace都消费同一纯投影policy，SSE复用eventPage。

GET conversation snapshot仅当请求精确单值 `X-Flow-Assistant-Stream: patch-v1`、挂载显式允许且022/read routes已准备时返回liveAssistantText=true；缺省/未知/重复header保持false。创建ACK与幂等已存receipt永远原stable false。此标志表示连接能读取协议，不保证runner/provider生成patch，不取决于lastTurn。

| TODO ID | 交付与验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT06C02-01 | 最小Interface/三件套/合法scope | runner_owner | 已准派工 |
| CHAT06C02-02 | 同一legacy投影，原cursor与空页/SSE重连 | runner_owner | 01 |
| CHAT06C02-03 | 显式header与readiness门槛，stable创建ACK | runner_owner | 01 |
| CHAT06C02-04 | 随机PG/动态HTTP局部行为、清理、独立review | runner_owner / Lead | 02/03 |
| CHAT06C02-05 | 公共mount/client及Web集成 | Lead / Web | 独立批准 |

只写7项claim scope；不改CHAT06领域、shared index/client/contracts。API挂载由Lead消费新增可选options；不新增依赖，不操作任何现服务。技能本地find-skills/codebase-design/clean-code/tdd/brainstorming已读，本次bounded方案已有GO批准；按HTTP可见行为红→绿，纯metadata不跑产品测试。架构影响仅兼容投影/连接协商，Lead负责集成图。

2026-10-06 06:51:25 UTC：实现77f0b152固定，8局部+1直接消费者/tsc通过；新增GO要求的snapshot统一no-store。只读协商和legacy投影不改原命令receipt。进入独立review，main/产品Web尚待公共挂载。
