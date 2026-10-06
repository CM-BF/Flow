# 活动扫描游标兼容交接

Task WPF-ACTIVITYC01；唯一分支 codex/web-activity-cursor-compatibility。固定基线86a36eaeffbf09f0a3772c3d1509c17dc0a76f92；实现target 889f433ef6972e4feee95aa878f0dbaf7da30448，已获root限定APPROVED。

只修 generic ConversationActivityProjection：允许过滤空/尾页 raw cursor 前进；reset 必须 after>watermark。沿用公开 EventPage/ActivityPort，无 DTO、HTTP client、server输入或新依赖。App/native activity/stream consumer不在本片。

来源：[固定输入与hash](input-provenance.json)、[领取](take-receipt.json)、[技能与clean-code](quality.md)。真实 C02 tests 的 HTTP after1/limit2→空entries/next3/hasMoretrue→ordinary5，以及 SSE 空页next33→恢复ordinary37，在本片使用明确标记的 contract fixture 通过实际reader/mock port重放。不是保存的原始HTTP抓包，不重新跑PG/HTTP服务，不声称本片做真实中心验证。

局部命令（Node24 PATH）：`pnpm exec vitest run apps/web/test/conversation-activity.test.ts`；`pnpm --filter @flow/web typecheck`。无UI变更，不启动预览/浏览器/模型/DB，已有所有服务保持。

唯一事实源：[plan](../../../plans/wpf-activity-cursor-compatibility/plan.md)、[status](../../../plans/wpf-activity-cursor-compatibility/status.md)、[review](../../../plans/wpf-activity-cursor-compatibility/review.md)。分支通过、独立review、main集成分别记录；由Lead受控集成，不merge main。

独立44/44已复审，作者44/44与tsc通过；完整来源/局限见[validation](validation.md)。main未集成，claim保留；没有新启动方式或URL，既有预览未变。
