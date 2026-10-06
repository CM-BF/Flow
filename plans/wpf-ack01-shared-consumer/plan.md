# WPF-ACK01 共享会话回执的 Web 消费

状态：in-progress。创建/更新：2026-10-06 10:46 UTC。父任务：[WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)；沿[模块设计规则](../../AGENTS.md#modular-design)。

固定输入 0cee7556befa1988e60bae94b510240122c34b88，公共实现 dc7f3e186ee7a628187f82734db73f48866b9f6e 已由Lead集成。Web复用 @flow/client 的创建/turn decoder及creation/context matcher，不再复制POST receipt字段规则。scope仅三现有入口、两个局部测试及本记录，无App/UI/shared/queue实现/依赖修改。

## Interface 与职责

| Module | 职责、输入输出及不变量 |
| --- | --- |
| 公共 client（只读输入） | 验证实际发出冻结请求与2xx回执shape/identity，失败抛UnknownConversationAcknowledgementError；网络/确定HTTP错误保原分类。当前context模板仅v1，未来v2必须共享扩展 |
| Web projection | POST通过共享decoder确认；继续负责outbox原key/body、everUnknown、会话绑定、已知turn冲突、GET/history、cap显示与read-sequence优先；迟到ACK不得降级最新GET |
| selection / receipts 薄入口 | 委托共享assert；保已有目录allowlist与immutable冻结接口，GET/Queue调用者仍可复用，不复制另一套decoder |
| 局部HTTPfixture | 随机loopback端口、内存原请求记录、真实FlowClient与projection；无模型/数据库，finally释放连接；故障2xx与显式原key恢复可观察 |

无新缓存/轮询/调度器；性能只记录原始请求数量/身份，不宣称渲染或时延收益。取消/close保已有projection lifetime，409不自动换revision或新key；v1省略/空knowledge兼容保持。扩展未来context需公共decoder单点修改，本片不提前接受未知v2。

## TODO

- [x] ACK01-01 三处薄入口委托公共回执验证，保既有Web投影和冻结策略。
- [x] ACK01-02 真实HTTP故障/恢复及直接消费者局部验证；记录clean-code和固定来源。
- [ ] ACK01-03 独立review、主线接收；分支通过不等main完成。

验收包括坏200JSON/shape/identity/context不清unknown原key/body；已知GET优于旧ACK；409无自动重发；创建profile/project匹配、知识有序tuple与Queue直接消费者保持。只跑本模块/直接依赖，不重跑完整浏览器矩阵。
