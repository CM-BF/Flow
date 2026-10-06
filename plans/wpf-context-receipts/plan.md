# WPF-CONTEXT02 知识引用回执

用户既有 U11 / REQ42 的纯接收接口片。父计划唯一入口：[Web 平台管理](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/plan.md)。

固定基线 fc113945ff73d1a43092d0a70b51e901aa4be1e2；唯一 owner w01_owner，派发 gpt-6-astra / ultra。八个 literal scope 见[领取回执](../../docs/evidence/wpf-context-receipts/take-receipt.json)。

- [x] WPF-CONTEXT02-01：核领取、冻结接口与边界。
- [x] WPF-CONTEXT02-02：可选知识引用解析后深冻结；共享有序完整 tuple 回执校验与 Queue 实际调用；验证变异、未知受理和原键重试。
- [ ] WPF-CONTEXT02-03：局部检查、clean-code、固定 target 独立审查并交主线。
- [ ] WPF-CONTEXT02-04：后继 owner 接实际 Send / Queue UI、项目选择及 create-only；本片不实施。

实现只改 receipts.ts、outbox.ts、queue/commands.ts 及三个专用/直接测试。复用已主线 selection.freezeContextSelection，保留缺省 knowledge 与显式空数组的请求形状；不合成引用、正文或 capability。非空引用要求同 project、精确顺序/版本/digest/locator、最多 4 条与 8192 bytes。中心额外完整输入预算拒绝必须保留引用和文本。

回执缺失、错序或任何 tuple 不符不能确认为成功；Queue 将此保留为 unknown，原 key / 原 payload 重试。Send guard 仅供后继 projection 调用，不能宣称当前 Send 已验证 context。纯文本兼容语义以固定公共合同及现 reader 测试核实。没有网络读取、模型、数据库、预览或依赖变更。

检查以公开 helper、outbox 和 QueueCommands 的行为为准；重点限额/深冻结/未知重试/新草稿隔离/连接 dispose，不做无关浏览器或全库测试。 [状态](status.md) / [审查](review.md) / [接口](../../docs/evidence/wpf-context-receipts/interface.md)。
