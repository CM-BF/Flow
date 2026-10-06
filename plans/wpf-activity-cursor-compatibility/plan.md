# WPF-ACTIVITYC01 活动扫描游标兼容

创建/更新：2026-10-06；状态：in-progress。唯一 owner workspace_panels_owner / gpt-6-astra ultra。

让通用活动列表在中心过滤流式正文引用后，仍能按原始扫描游标继续读取后续普通活动。固定基线 86a36eaeffbf09f0a3772c3d1509c17dc0a76f92；来源与领取见[输入](../../docs/evidence/wpf-activity-cursor-compatibility/input-provenance.json)、[回执](../../docs/evidence/wpf-activity-cursor-compatibility/take-receipt.json)。

只写 apps/web/src/conversation-activity/projection.ts、apps/web/test/conversation-activity.test.ts 及本计划和独占证据目录。无共享/server输入，不修改 App/Thread/新 native activity 模块。旧 ACTIVITY 树已释放，不在那里修改。

已确认：非 reset 的 after ≤ nextCursor ≤ watermark，hasMore 等价于 nextCursor < watermark；有更多时必须推进；条目严格递增且不超过 nextCursor。允许空页、过滤尾条使 lastReturned < nextCursor。reset 仅 after > watermark，且 nextCursor=0、entries=[]、hasMore=false。任务身份、历史条目冲突/重复保护、按需详情和隐藏生命周期保持。

TODO：
- [x] WPF-ACTIVITYC01-01 核固定来源、领取、技能与唯一事实源。
- [x] WPF-ACTIVITYC01-02 修复扫描游标验证，保留完整护栏。
- [x] WPF-ACTIVITYC01-03 用实际 reader 验证 contract fixture、旧页和坏页，保存红绿证据。
- [ ] WPF-ACTIVITYC01-04 固定提交、独立审查、dashboard/Lead交接。

测试跨同一公开 ActivityPort seam 运行真实 ConversationActivityProjection。正向 fixture 对应 C02 已通过的真实 HTTP 断言，但本次为 mock port 重放，不是历史 raw capture、不冒充真实 HTTP/DB 联调。加空扫描页、尾过滤、终末空页、33→37恢复，反向验证身份、顺序、范围、重叠冲突与 reset；保留原生命周期/0详情检查。0模型/DB，不启动服务，不重跑无关 browser/build。架构影响仅修正既有分页不变量，无新模块/API。

参考：[status](status.md)、[review](review.md)、[质量](../../docs/evidence/wpf-activity-cursor-compatibility/quality.md)。
