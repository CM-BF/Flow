# LAB01 独立审查

状态：NOT_STARTED。空模板不表示approval。

## Target 与验收

- Base：`5bdb7fa293ebd0d13515fe367f004687927f1897`；target：待交付提交。
- Worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/performance-probes`；branch：`codex/performance-probes`；dirty：review时核验。
- 范围：两个vanilla toy、原始JSON、统计脚本、截图与测量限制；排除产品代码、真实模型、云与容量承诺。
- 关键检查：功能一致性、预算、≥20有效重复、p50/p95、真实DOM计数、计时范围与数据传输定义。

## 可复制审查任务

只读审查LAB01。先读AGENTS、plan/status及证据，核验实际base/head/worktree/dirty。检查公开页面功能、测量边界、原始样本与分位数，确认无浏览器/React/模型性能过度推断。复跑前遵守本地0模型0云、每样本10秒、总benchmark120秒和64MiB预算；不改产品或原始结果。报告severity/blocking、文件行、检查与限制，由owner修复。只有明确授权为本review唯一owner且模型至少Sol时才写本文件。

## 检查 / findings / 结论

未执行独立检查；findings未评估；结论未审查。交付时提供原始证据与具体target，修复必须绑定新SHA后复审。
