# WPF-RENDERERI01 聊天详情显示接线

2026-10-06 · in-progress。唯一owner w01_owner；固定base115b0dbdfa02db5483f9e9699852682ce699633c，已含受审renderer747cbe616408dc3e44ab3587216c5753e6de3994。

目标：把受信消息data renderer接到真实官方Thread，保留现有按需完整回复读取与草稿，关闭/隐藏/换中心时旧绑定失效。P01仍是唯一插件生命周期权威，不新增安装或授权状态。

父计划为[现有Web平台计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/plan.md)。九literal可写范围以[原领取](../../docs/evidence/wpf-renderer-i01/take-receipt.json)为准；不改共享合同/旧renderer/P01/官方Thread/会话projection、outbox或发送协议。

已批准方案：App原生hidden保留，visible={!overview && pageVisible && group.activeId===id}经ChatPane/ConversationThread显式传桥；split两可见pane皆可读，不使用focused权限。仅本provider桥随visible控制注册和display lease，稳定bindings保留展开与projection缓存，resume新代际拒旧port。session在await dispose前同步失效。模块级纯identity converter保持稳定，onNew及门禁实时更新，不memo整个adapter。

## TODO

- [ ] RENDERERI01-01：绑定session/本pane真实message-turn-task身份与P01内建renderer，visible/close/epoch失效。
- [ ] RENDERERI01-02：真实App按需读取、双分屏/隐藏恢复/草稿/disabled fallback及发送回归。
- [ ] RENDERERI01-03：固定实现与证据，独立review、修复、交主Lead集成。

验收：0初始detail→展开1→cache0；同ID跨中心迟到、错误message/turn、隐藏后的旧callback拒绝；隐藏不影响另pane/共享插件，resume不自动GET。真实App nativehidden与独立模块Activity证据分开。送出/Enter/queue intent/onNew/isSendDisabled、同revision正文/history/running变化不被converter稳定化冻结。局部模块与直接消费检查，HTTPfixture双主题390键盘；0真实模型/产品数据库。

风险：现App保留已关闭conversation projection缓存，不能以hasDraft推断pane仍可读；会话后台刷新创建新turns引用仍可能转换，当前清码不声称已改善用户延迟。接口/结构变化交架构owner登记，本文不另建架构图。

[状态](status.md) · [review](review.md) · [质量](../../docs/evidence/wpf-renderer-i01/quality.md)
