# TUI01A Review

**状态：CHANGES_REQUESTED。**

- Review target commit：9e5588d4d6b24234bb829c23269e6e72caca44af
- Base commit：77c420cf9ee5de0291ea93014b6ea11aead6fab5
- Source/raw binding：[manifest](../../docs/evidence/tui01a/manifest.json)，17 source、23 raw、6 readonly inputs。
- Reviewer：Mika / gpt-6-astra 与 status_read / gpt-6-astra，2026-10-06 09:39:58 UTC；只读，不重跑17。
- 原始收据：[independent-review-initial.md](../../docs/evidence/tui01a/independent-review-initial.md)。
- P2-A：save拒绝与dispose并发使退出清理提前拒绝；P2-B：未知200/受理turn不匹配前提前清intent。无P1，2个blocking P2。
- 作者回应：接受，两项定向公开行为回归与最小修复，原证据保持，待新target增量复审。

只读核固定source/manifest/工作树，按统一模块规则检查共享descriptor与两个consumer、中心权威、unknown/持久key、连接隔离、退出不cancel、终端escape、输入/列表/observer边界。检查真实HTTP/PG与PTY分别证据；不启provider或个人服务。未审不表示无finding，作者检查不代独审。
