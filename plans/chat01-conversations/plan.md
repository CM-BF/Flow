# CHAT01 持久对话中心首片段

状态：completed（typed消费delta交付，待独立复审）；创建2026-10-06。Owner runner_owner / gpt-6-astra。Worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/conversation-center`，branch `codex/conversation-center`，base6bb380b900f17bfbf808a95e7d9c0313c4991922。

目标：普通聊天直接进入持久conversation/有序turn→独立durable task，不等待O01 goal编排。conversation ID与native session ID分开；复用acceptTask事务和已有runner session affinity/互斥/fencing。首片段仅已完成上一轮之后的follow-up，忙/uncertain409；queue/steer明确unsupported，不能偷换为内存队列/取消。

公共合同见packages/contracts/src/conversations.ts；中心模块独立migrateConversations/registerConversationRoutes，Lead统一接exports/client/生产入口；不改runner.ts或Web。requested具体model、非disabled thinking、tools none当前无法下发时明确拒绝。effective未知保留unknown/null，仅精确已知adapter版本可声明readonly/thinking-disabled，并附来源。

助手回复首段是精确claude-sdk-0.3.290-v1的最终结果兼容projection：已绑定turn/task当前attempt/session、成功状态与唯一完整text artifact/version一致；缺失/多结果/旧attempt/未知版本显示unavailable。不能从artifact标题或timeline文案推断回复。后继fenced typed assistant-final/delta与effective declaration是完整CHAT必要项，本段不假称已有实时正文。

## TODO

- [x] **CHAT01-01** 小公共合同、模块设计与runner后继seam，尽早交Web/Lead消费。
- [x] **CHAT01-02** migration007、PG持久conversation/turn、事务CAS/幂等受理及分页/权限。
- [x] **CHAT01-03** 可靠assistant结果投影与typed lazy detail、native resume关联，unknown/旧结果拒绝。
- [x] **CHAT01-04** 0模型真实PG/HTTP验证身份、并发、重复、重启、resume affinity、回复归属与unsupported；固定证据/target交独立review。

验收seam按派工已明确为公共HTTP与实际PG；测试红→绿纵向推进，SDK注入只代替真实模型，不把fixture当自然语言验收。专用flow_chat01/动态端口，生命周期清理不影响其他DB/4320。完整自然语言模型验收、实时assistant流、模型选择/思考配置、queue/steer留明确后继，真实模型本轮0。

唯一status见[status](status.md)，独立review默认[NOT_STARTED](review.md)。写scope严格按claim；[架构](../../docs/architecture/chat01-conversations.md)与[证据](../../docs/evidence/chat01/README.md)。

- [x] **CHAT01-05** 完整合入已固定CHAT02依赖并消费typed助手最终消息；v2缺失不回退v1、实际effective不被旧推断覆盖，局部0模型PG/HTTP绑定/重报/重启验收，独立固定delta target。

本轮typed消费优先readAssistantFinal，绑定task/currentAttempt/nativeSession，v2缺失或损坏不回退artifact。会话用户requested、runnerRequested与实际effective分开；actual thinking unknown保持原样，init报告的tools不等同工具授权范围。页查询仍有N+1读取与完整正文hash成本，后继按实际负载做批量查询/轻引用优化，本段不扩broker/容量目标。
