# Web 当前交接与唯一来源

更新：2026-10-06T21:28:49.564681+00:00。本页只作协调与证据索引；功能进度以各 owner 的唯一 status 为准，领取以 D04 账本为准。

## 共享窗口

**当前无 holder：Mika 21:28:25 fresh资源不足、未调用入口即归还；Web 无运行、预约或 gate。**
[最新入站](mika-svc07-not-run-return-212825.json)：free 1,143,750,656 B，低于原门槛64,208,896 B；0 child/PG/HTTP。本组未另取样，不追涨或自动重试。
[Lead 个人发布已21:27:19完成归还](lead-personal-publication-return-212719.json)：af51 accepting v18、d629 current v3、3 retained，0 query/tab，均按原 operator 入站归因。
[当前资源事实](resource-window-current.json)保留原门槛；232文件逻辑字节不等于实际物理回收或已满足gate。

**供 Lead 直接读取：两棵旧树消费者确认已完成。**
[短报告](readability-sparse-known-consumers/report.md) · [fresh RELEASED + 精确机器证明](readability-sparse-known-consumers/manager-confirmation.json) · [root 独立接收](readability-sparse-known-consumers/root-review.json)。
全12目录零已知依赖命中蕴含更窄232-file子集；KEEP整个chat06p01、w01/workspace-panels闭包、thread-revision/upstream与provenance.md、w01/.gitattributes、10个d06 .mjs及所有preview/deps/未知路径。仅Lead在个人窗口外逐树sparse，本组不操作。

## 唯一 owner 与领取

[21:01:31 D04 只读观察](web-source-dispatch-take-observation-2101.json)核对四个原 claim active、无 overlap。
[21:05:22 同范围补派观察](web-p2-source-dispatch-take-observation-2105.json)保持原 owner 与范围，无 overlap。
以下是来源指针，不另维护 TODO、检查或 review 状态；新写入和运行前仍须 fresh 核验。

| 工作 | 唯一 owner / worktree / branch | 原 claim 与唯一 status |
| --- | --- | --- |
| Web 管理 | d01_owner；web-platform-management；codex/web-platform-management | 632a7149 v3 / 6 scopes；[status](../../../plans/web-platform/status.md) |
| 草稿恢复 | workspace_panels_owner；web-conversation-recovery；codex/web-conversation-recovery | 6ff988b2 v4 / 21 scopes；[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery/plans/wpf-conversation-recovery/status.md) |
| 逐消息设置控件 | w01_owner；web-message-settings；codex/web-message-settings | a5b0c231 v2 RELEASED / 原8 scopes；[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings/plans/wpf-message-settings/status.md) |
| 看板摘要与详情 | w01_owner；dashboard-summary-detail；codex/dashboard-summary-detail | b554ddb6 v1 / 9 scopes；[status](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-summary-detail/plans/wpf-dperf04-summary-detail/status.md) |

已释放的旧片不重新领取：[DPERF05 唯一交付记录](/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-status-timestamps/plans/wpf-dperf05-status-timestamps/status.md)、
[RELEASE03 唯一交付记录](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-current-preview-compatibility/plans/wpf-release03-current-preview/status.md)、
[PROFILEC02 唯一交付记录](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-profile-readonly-compatibility/plans/wpf-profile-readonly-compatibility/status.md)。

## 正式主线接收请求

[MessageSettings 受控组件主线接收包](message-settings-main-reception/request.json)已就绪提交原 Execution Lead：固定 270c 六源、owner f80f clean、37 direct 与4 browser的限定独审原件。
按 GO 的 OPS-001-08 要求独立接收，不等 Recovery 页面或未来 App 接线；真实 Send/Queue/Recovery 与成熟快速选择仍归原 TODO11。
[固定 main 对照及 root 审查](message-settings-main-reception/root-review.json)未识别独立接收阻塞；[c8e 正式主线独审](message-settings-main-reception/main-integration-review.json)已核六源及15消费者输入，owner f80f 已限定交付并停写，[fresh CAS v2 RELEASED](message-settings-main-reception/release-receipt.json)；不重跑。

## 当前动作与验收入口

- Recovery：原 owner 已交[8ed 两文件固定源码](recovery01-8ed-identity-source/intake.json)，owner 已 seal 000a clean / 19 pins 核同；[root 限定源码复审](recovery01-8ed-identity-source/root-source-review.json)关闭两项 finding。
  [固定设计](recovery01-rec4d-identity-design/root-design-review.json)要求可辨识草稿摘要与 exact record 身份；同段补[关闭时合法入口回焦](recovery01-rec4d-identity-design/root-focus-review.json)，保持其他 17 源及原权限/断言。
  [rec4d 失败与完整清理独审](recovery01-4d-actual/root-runtime-review.json)不等于产品通过；[新8ed只读候选](recovery01-next8ed-prepared/root-preparation-review.json)已核，真实页面尚未复验。
  [下一准入条件](recovery01-rec4d-finding-wait.json)保留累计 25520.435ms，整数余量 64479ms 含 15000ms 清理。
- Settings：限定控件的[4 项浏览器证据已独立批准](message-settings-b5-actual/root-runtime-review.json)，
  [owner 正式 seal](message-settings-b5-actual/owner-approval-seal.json)供 Lead 接主线；真实 App 发送、排队、恢复与成熟快速选择仍属后继。
  不重复已过的类型、37 项 direct 或 4 项页面检查。
- DPERF04：[544c 停止记录窄修已获限定源码准备批准](dperf04-544c-prepared/root-source-review.json)，
  [同一 native Chrome 边界已精确重绑](dperf04-544c-prepared/native-boundary-rebind.json)；原 owner 已 seal 929b，[最终 HEAD、边界和全部 pins 已核](dperf04-544c-prepared/final-binding-verification.json)。
  七项目源 45f8 与旧 Node 证据不动，浏览器仍 0/60 秒含 15 秒清理；无 gate，资源与共享调度待准入。

## 旧树资源候选

[限定已知消费者确认](readability-sparse-known-consumers/report.md)：两旧 claim 已 released，Recovery/Settings/DPERF 声明及延迟读取对12目录零命中，可涵盖 Lead 更窄232文件子集。
所有明确 KEEP 与未知具体路径保留；只有 Lead 在个人窗口外逐树 sparse，本组不操作或保证全系统未来依赖。

## 需求与后继

用户要求的跨 lead 防 overlap、take 在 dashboard 可查，沿[原计划 U08/U12/REQ37](../../../plans/web-platform/plan.md)和 D04 单一账本执行。
P01 认证外层 host 的[限定差异研究](recovery-connection-p01-4d330-delta/intake.json)归原 REQ22/23、MATURE06-04；不新增 task/slot/claim。
其 private RecoveryHost.restore(record, lease) 与 UI RecoveryWorkspace.restore(record, retry?) 不可混用。
[MATURE02 快速设置管理结论](message-settings-quick-controls-queue-assessment.json)：保持原 TODO11 队列；局部筛选可独立，但安全 Apply 的宿主草稿代际接口、新隔离写权与验证未就绪，当前不 take/派实施。
MATURE01/05/06 视觉与 D06 固定架构快照沿已有计划，不扩当前 source 范围。

## 历史入口

[此前完整交接原文快照](mature-task-handoff-history-through-20261006-2100.md)逐字保留，含原发布 tuple、来源、预算、窗口和失败证据入口。
快照中的“当前”均属于截至该时点的历史，不覆盖本页与 owner status。
原 run/raw/review 文件未移动或改写；本次只压缩导航并记录新的正式派工与 F04 实际归还。
