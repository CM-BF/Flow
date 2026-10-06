# TUI01A Review

**状态：CHANGES_REQUESTED。**

- Review target commit：29b546537862c562569ce9df74919f2239d94df8
- Base commit：334448c4b78a1138cc4e9a9dd5dee56e33f2fb35（本次修复delta）；原feature基线77c420cf9ee5de0291ea93014b6ea11aead6fab5
- 原target9e5588d绑定[manifest](../../docs/evidence/tui01a/manifest.json)；修复delta绑定[manifest-review-fixes](../../docs/evidence/tui01a/manifest-review-fixes.json)，6 source、5 raw。
- Reviewer：Mika / gpt-6-astra 与 status_read / gpt-6-astra，2026-10-06 09:39:58 UTC；只读，不重跑17。
- 原始收据：[independent-review-initial.md](../../docs/evidence/tui01a/independent-review-initial.md)。
- P2-A：save拒绝与dispose并发使退出清理提前拒绝；P2-B：未知200/受理turn不匹配前提前清intent。无P1，2个blocking P2。
- 作者回应：接受，两项定向公开行为回归与最小修复，原证据保持，新target 29b546537862c562569ce9df74919f2239d94df8，19/19（11重叠+8新）/types0，待增量复审。

只读核固定source/manifest/工作树，按统一模块规则检查共享descriptor与两个consumer、中心权威、unknown/持久key、连接隔离、退出不cancel、终端escape、输入/列表/observer边界。检查真实HTTP/PG与PTY分别证据；不启provider或个人服务。未审不表示无finding，作者检查不代独审。
