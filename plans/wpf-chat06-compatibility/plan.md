# WPF-CHAT06C01 流式能力读取兼容

状态：in-progress。唯一owner workspace_panels_owner / gpt-6-astra ultra。本片使聊天读取端容忍中心可选的流式能力标记，不启用流式正文或协议协商。既有最终回复、排队、身份和未确认回执行为保持。

准确base `a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8`；独立树 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-stream-compatibility`，branch `codex/web-stream-compatibility`。先核不存在建树，正式[receipt](../../docs/evidence/wpf-chat06-compatibility/take-receipt.json)后才修改。claim ca26e49b-b750-43a7-8bf7-ce1b987f50c9 v1，06:45:09.159Z committed。

四literal scopes：apps/web/src/conversations/projection.ts；apps/web/test/conversation-projection.test.ts；plans/wpf-chat06-compatibility；docs/evidence/wpf-chat06-compatibility。共享例外仅原样pick Lead批准86fc3af54eb500d24416121b4f36e701ea9fd3c4，before/after hash通过，本地input3363c14d0ba12f4dc6eabc275355f9132564d01f，仅conversations.ts optionalboolean。[provenance](../../docs/evidence/wpf-chat06-compatibility/input-provenance.json)。不合F01/领域整branch，不改其他shared、App/Thread/queue/outbox或依赖。

## TODO

- [x] WPF-CHAT06C01-01：领取、技能与固定单文件输入/hash核验、唯一三件套。
- [x] WPF-CHAT06C01-02：GET/CREATE读取missing→false、严格boolean；其他能力/身份门禁不放宽。
- [x] WPF-CHAT06C01-03：局部真实FlowClient wire测试与直接回归、typecheck、clean-code证据。
- [ ] WPF-CHAT06C01-04：固定实现独立review、聚合确认与MainLead交付；不自行merge main。

## 验收

GET与CREATE分别缺失/false/true；null、字符串、数值、对象拒绝。queue false/true独立保留。新标记不绕过conversation/turn/task/project/profile身份；坏CREATE保持unknown且0turn，恢复原key/payload；坏GET保留旧态报错。final重放与历史gap原回归保留。0stream/detail自动请求、0协商header。正向使用新公共类型，畸形只经mock fetch Response→真实FlowClient入站，不用as/any伪造typed对象。无浏览器UI变化不重跑全套；0模型/DB/真实服务操作。

## 后继协商（已由GO确定，不属于本片）

CREATE ACK及同key replay永久原receipt、显式liveAssistantText:false。只有GET snapshot按连接header `X-Flow-Assistant-Stream: patch-v1`协商；缺省/未知false，center mount和产品消费者门槛满足才true。不按lastTurn是否已有patch或provider是否产delta判能力。本片不发该header，不启用正文或流读取。后续共享协商固定SHA和正式产品范围另行受领，不能把本reader片称实时正文已完成。

[status](status.md) · [review](review.md) · [证据](../../docs/evidence/wpf-chat06-compatibility/README.md)

固定候选 8c56211739ae0c20816c67caad13cee510130514；作者104局部checks及Webtsc通过，独立review NOT_STARTED。[验证](../../docs/evidence/wpf-chat06-compatibility/validation.md)保留red/green与源绑定，未启用流式消费者。
