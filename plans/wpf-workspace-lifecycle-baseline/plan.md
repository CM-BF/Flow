# WPF-WORKSPACEPERF01 工作区生命周期基线

2026-10-06；delivered（有界partial基线）。父 [WPF-MATURE-05](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-05-workspace/plan.md)，co-lead Web /root。遵循[根模块规则](../../AGENTS.md#modular-design)。

目标：在固定真实App源码上量化8/16/32个累计合成conversation的visible/hidden/closed-clean/closed-protected可见DOM与HTTP观察，验证重开保留草稿、知识选择及原key未知receipt；形成下一最小回收Interface，当前不改生产代码。0provider/产品DB/个人服务。

- [x] WPF-WORKSPACEPERF01-01：固定输入、独占scope、技能/fixture Interface及观察口径。
- [x] WPF-WORKSPACEPERF01-02：两个新专测复用真实App和已有HTTPfixture，最多2可见pane，区分迟到读取与新读。
- [x] WPF-WORKSPACEPERF01-03：有界实验累计90秒预算（含cleanup），原始证据≤8MiB；三档与保护状态已记录，8检查完成/1末尾导航失败，整体partial。
- [x] WPF-WORKSPACEPERF01-04：固定目标独审、交付与main接收；后继优化须新scope，不能把基线当性能达标。

基线c450c2da7e6185b88db9f46e0299ee504ee6f3e8。唯一树web-workspace-lifecycle-baseline / codex/web-workspace-lifecycle-baseline；四literal见[receipt](../../docs/evidence/wpf-workspace-lifecycle-baseline/take-receipt.json)。不修改App/Thread/projection/stream/shared/package或旧fixture。

实验复用startContextPreview及其stream/queue/conversation fixture，fixture响应是模拟、浏览器加载实际App。以可见tab/textarea/知识与receipt交互验证，按会话分类HTTP读取和activeStreamCount；DOM移除不等JS引用/heap释放。JS私有缓存、可靠延迟分位数未知，不注入生产对象或第二生命周期authority。只在实验自己的page/server做cleanup，保留所有既有服务。

90秒包括启动、交互、观察、截图与清理，80秒停止新增实验动作。原始失败不改写；超预算/缺档记录partial，不能扩时追绿。不得用丢弃未决receipt换取回收数据。固定源hash、只读依赖、实际运行HEAD/dirty分开，禁止事后回填。

2026-10-06 验证收口：两轮合计保守79.322秒，未追加第三轮。截图/theme与native page-hidden未覆盖；这些缺项保留，不将基线当性能达标。总览背景读取和命令pending生命周期的下一Interface建议见证据。

2026-10-06 11:07:36 UTC root独审批准partial基线，P3缺项保留；TODO-04 review部分完成、main仍待接收。后继优先MATURE05真实组合标签产品，不再为补图扩本次实验预算。

主线收口：362af3bac77541e5a60979326bcf4d4b8c947915受控接收两固定测试源与原partial证据；本片段交付完成，后继产品/未测项目不因此完成。见[主线观察](../../docs/evidence/wpf-workspace-lifecycle-baseline/main-observation.json)。
