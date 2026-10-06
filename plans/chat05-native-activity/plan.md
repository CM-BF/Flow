# CHAT05 原生活动

状态：in-progress。Owner：runner_owner / gpt-6-astra。Base：3d4985fca060155435b159e0467815bf8e88b8b8。

让对话读者看见真实的助手内容块、工具参数生成、执行进度和结果；参数完成不表示工具已执行成功。保留当前工具授权、最终回复和任务状态的独立权威。

| TODO ID | 交付与验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT05-01 | 固定 SDK 0.3.290 合同、归属及有界详情，给 Web/client 消费 | runner_owner | 已批准边界 |
| CHAT05-02 | 独立完整帧 mapper：多块、thinking/redacted、工具生命周期、重报、缺失结果 | runner_owner | 01 |
| CHAT05-03 | PG 020 迁移、fenced 接纳、轻列表/懒详情；真实 HTTP 验证身份/归属/重报/恢复 | runner_owner | 01 |
| CHAT05-04 | SDK adapter→现有 durable outbox→PG→owner GET，注入 SDK 验证取消后 unknown | runner_owner | 02/03、O07 归还 SDK 接缝 |
| CHAT05-05 | clean-code、局部检查、固定证据、独立 review、main 接收 | runner_owner / Lead | 04 |

实现为帧 mapper、事务 store 和 owner read route 三个窄模块。timeline 仅引用，原始工具输入输出和 SDK 公开 thinking 按需读取；不存 opaque thinking 签名或 redacted payload。不启用任何新工具，不调用模型解释事件。完整帧先行，不声明逐 token 流或缺失 thinking 的内容。历史 user replay 不归属当前 attempt；工具结果必须关联当前 attempt/session/parent 的调用。取消/失联且无结果保持 unknown。

写范围以 claim 回执为准。共享 export/client/mount 由 Lead 接；O07 独占 claude.ts/runtime.ts/runner.ts 归还并原子 amend 后才接线。专用随机 flow_chat05 数据库/动态端口/合成 SDK，0 query、0 云、不操作现有服务。

技能：本地 find-skills→brainstorming/codebase-design/tdd/clean-code；授权设计不重复审批。质量与发现见 [quality.md](../../docs/evidence/chat05/quality.md)。架构影响：新增原生活动持久观察流，沿用 runner fence/outbox；待 Lead 在集成点更新架构基线。
