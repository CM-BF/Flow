# WPF-WORKSPACEPERF01 工作区生命周期基线

2026-10-06；in-progress。父 [WPF-MATURE-05](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-05-workspace/plan.md)，co-lead Web /root。遵循[根模块规则](../../AGENTS.md#modular-design)。

目标：在固定真实App源码上量化8/16/32个累计合成conversation的visible/hidden/closed-clean/closed-protected可见DOM与HTTP观察，验证重开保留草稿、知识选择及原key未知receipt；形成下一最小回收Interface，当前不改生产代码。0provider/产品DB/个人服务。

- [ ] WPF-WORKSPACEPERF01-01：固定输入、独占scope、技能/fixture Interface及观察口径。
- [ ] WPF-WORKSPACEPERF01-02：两个新专测复用真实App和已有HTTPfixture，最多2可见pane，区分迟到读取与新读。
- [ ] WPF-WORKSPACEPERF01-03：一次实验90秒硬预算（含启动与10秒cleanup），原始证据≤8MiB；记录三档与保护状态，覆盖不全如实partial。
- [ ] WPF-WORKSPACEPERF01-04：固定目标独审、交付与main接收；后继优化须新scope，不能把基线当性能达标。

基线c450c2da7e6185b88db9f46e0299ee504ee6f3e8。唯一树web-workspace-lifecycle-baseline / codex/web-workspace-lifecycle-baseline；四literal见[receipt](../../docs/evidence/wpf-workspace-lifecycle-baseline/take-receipt.json)。不修改App/Thread/projection/stream/shared/package或旧fixture。

实验复用startContextPreview及其stream/queue/conversation fixture，fixture响应是模拟、浏览器加载实际App。以可见tab/textarea/知识与receipt交互验证，按会话分类HTTP读取和activeStreamCount；DOM移除不等JS引用/heap释放。JS私有缓存、可靠延迟分位数未知，不注入生产对象或第二生命周期authority。只在实验自己的page/server做cleanup，保留所有既有服务。

90秒包括启动、交互、观察、截图与清理，80秒停止新增实验动作。原始失败不改写；超预算/缺档记录partial，不能扩时追绿。不得用丢弃未决receipt换取回收数据。固定源hash、只读依赖、实际运行HEAD/dirty分开，禁止事后回填。
