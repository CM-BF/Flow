# Web 当前交接与唯一来源

更新：2026-10-06T21:08:57.559956+00:00。本页只作协调与证据索引；功能进度以各 owner 的唯一 status 为准，领取以 D04 账本为准。

## 共享窗口

**当前无 holder：Mika SVC07 fresh 准入 HOLD / NOT_RUN 后已归还，Web 无运行、预约或 gate。**
Mika 回报 21:08:06 可用 1,176,248,320B，低于原 1,207,959,552B 门槛；exit2、0 attempt/child/PG/HTTP，8 个预期输出均 absent，无待启动进程。
见[实际 NOT_RUN 归还](mika-svc07-not-run-return.json)及[当前资源事实](resource-window-current.json)；[原交接](web-svc07-window-handback-2108.json)和[接收](mika-svc07-handoff-accepted.json)保留。
Recovery/DPERF04 继续源码修复；不追涨采样、不自动重试或降门槛。候选真正 ready 并获新明确窗口后，才按原门槛一次 fresh 准入。
此前 F04 20:59:20 完整清理的[回执](f04-cleanup-return-205920.json)保为历史；个人服务不由本组操作。

## 唯一 owner 与领取

[21:01:31 D04 只读观察](web-source-dispatch-take-observation-2101.json)核对四个原 claim active、无 overlap。
[21:05:22 同范围补派观察](web-p2-source-dispatch-take-observation-2105.json)保持原 owner 与范围，无 overlap。
以下是来源指针，不另维护 TODO、检查或 review 状态；新写入和运行前仍须 fresh 核验。

| 工作 | 唯一 owner / worktree / branch | 原 claim 与唯一 status |
| --- | --- | --- |
| Web 管理 | d01_owner；web-platform-management；codex/web-platform-management | 632a7149 v3 / 6 scopes；[status](../../../plans/web-platform/status.md) |
| 草稿恢复 | workspace_panels_owner；web-conversation-recovery；codex/web-conversation-recovery | 6ff988b2 v4 / 21 scopes；[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery/plans/wpf-conversation-recovery/status.md) |
| 逐消息设置控件 | w01_owner；web-message-settings；codex/web-message-settings | a5b0c231 v1 / 8 scopes；[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings/plans/wpf-message-settings/status.md) |
| 看板摘要与详情 | w01_owner；dashboard-summary-detail；codex/dashboard-summary-detail | b554ddb6 v1 / 9 scopes；[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-summary-detail/plans/wpf-dperf04-summary-detail/status.md) |

已释放的旧片不重新领取：[DPERF05 唯一交付记录](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-status-timestamps/plans/wpf-dperf05-status-timestamps/status.md)、
[RELEASE03 唯一交付记录](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-current-preview-compatibility/plans/wpf-release03-current-preview/status.md)、
[PROFILEC02 唯一交付记录](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-profile-readonly-compatibility/plans/wpf-profile-readonly-compatibility/status.md)。

## 当前动作与验收入口

- Recovery：原 owner 已获[两文件 source-only 派工](recovery01-rec4d-identity-design/dispatch.json)。
  [固定设计](recovery01-rec4d-identity-design/root-design-review.json)要求可辨识草稿摘要与 exact record 身份；同段补[关闭时合法入口回焦](recovery01-rec4d-identity-design/root-focus-review.json)，保持其他 17 源及原权限/断言。
  [rec4d 失败与完整清理独审](recovery01-4d-actual/root-runtime-review.json)不等于产品通过；新源码固定后再独审，当前不运行。
  [下一准入条件](recovery01-rec4d-finding-wait.json)保留累计 25520.435ms，整数余量 64479ms 含 15000ms 清理。
- Settings：限定控件的[4 项浏览器证据已独立批准](message-settings-b5-actual/root-runtime-review.json)，
  [owner 正式 seal](message-settings-b5-actual/owner-approval-seal.json)供 Lead 接主线；真实 App 发送、排队、恢复与成熟快速选择仍属后继。
  不重复已过的类型、37 项 direct 或 4 项页面检查。
- DPERF04：[21:01 只读 pins 核验](dperf04-browser-ready-readonly-2101.json)保为该时点事实；随后发现[末次写报告期间的 late-stop P2](dperf04-late-stop-addendum.json)。
  原 W01 已获[原范围准备稿窄修](dperf04-late-stop-dispatch.json)，当前不 READY、不签 gate；七项目源 45f8 与旧 Node 证据不动。
  [真实 native Chrome 边界](dperf04-b2-native-chrome-boundary-acceptance.json)已接受，修后只需精确重绑；原浏览器 0/60 秒含 15 秒清理。

## 需求与后继

用户要求的跨 lead 防 overlap、take 在 dashboard 可查，沿[原计划 U08/U12/REQ37](../../../plans/web-platform/plan.md)和 D04 单一账本执行。
P01 认证外层 host 的[限定差异研究](recovery-connection-p01-4d330-delta/intake.json)归原 REQ22/23、MATURE06-04；不新增 task/slot/claim。
其 private RecoveryHost.restore(record, lease) 与 UI RecoveryWorkspace.restore(record, retry?) 不可混用。
MATURE02 快速设置、MATURE01/05/06 视觉与 D06 固定架构快照均沿已有计划，不扩当前 source 范围。

## 历史入口

[此前完整交接原文快照](mature-task-handoff-history-through-20261006-2100.md)逐字保留，含原发布 tuple、来源、预算、窗口和失败证据入口。
快照中的“当前”均属于截至该时点的历史，不覆盖本页与 owner status。
原 run/raw/review 文件未移动或改写；本次只压缩导航并记录新的正式派工与 F04 实际归还。
