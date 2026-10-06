# WPF-ATTACHI02 附件生产接线

2026-10-06。所属大task为 [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md)，co-lead Web /root，唯一 writer w01_owner / gpt-6-astra / ultra。本计划与 [status](status.md)、[review](review.md) 是本任务唯一源。

目标：在真实聊天中通过现有插件入口添加、预览、发送或排队已确认的文本附件，保留原请求、草稿和权限边界。阶段一已领取十二路径，先连接真实 Outbox、QueueCommands 与 PluginHost；完整 App、HTTP 和 Send/Queue 验收仍属于本任务，不能以独立 binding 文件代替完整交付。

## 输入与范围

固定组合输入 1c4968354dabce1e6748f3301a2e6eecd33e77d4，含独审附件模块 4c4de124b24a85b9e2a13e097b29c80b1e84d11a、六公共 client、共享 v2 ACK、真实 factory 与 CACHE。精确阶段一权限见 [committed receipt](../../docs/evidence/wpf-attach-i02/claim-receipt.json)。当前 App/session/Thread/projection 等后十二路径尚未领取，实施前须管理者 fresh amend。五个附件输入模块、官方 Thread、shared/client/contracts、依赖均只读。

## Module 与 Interface

遵循[根模块规则](../../AGENTS.md#modular-design)。材料冻结模块负责 detach/deep-freeze 与有序请求兼容，Outbox/QueueCommands 持有已接管请求；公共 matcher 唯一负责 ACK。新的附件 binding 负责 host 私有权限、稳定 view.key、当前 route 映射和六 client 的窄端口，不持有第二套 plugin/授权权威。P01 负责注册、激活、停用，App 仍是 view retention/final disposal 唯一 owner。

Input 的 immutable viewId 使用 view.key。临时 draft→conversation 路由变化不得丢上传记录或选择；实际 connection/project/权限变化使旧口失效。visible 是实际 pane/page 可见，不是 picker 开关。折叠 picker 后已选材料可提交，正文始终显式读取。

一次提交在官方 composer 异步准备前同步捕获 intent/profile/knowledge/attachments/身份。准备后重新验证 token，真实 local receipt 同栈接管后才 consume；网络 ACK 不清新稿。pending capture/submission 即使 items 被删除也计入 CACHE 保护。准备途中隐藏/撤权失败要保留可恢复原稿，不能降级纯文本或创建请求。

旧中心仅空材料请求省略 attachments；非空用真实能力和 project gate。knowledge 与 attachments 各自保序，编译 knowledge 在先。unknown 原 key/body/ref 顺序重试；仅公共 matcher 校验 v2。存储拒绝/损坏不删除 raw，不让附件初始化错误拖垮纯文本聊天。404 upload lookup 不能证明未提交。

## 验证与资源预算

先必要 unit/直接消费者验证材料冻结、真实 Outbox/Queue/P01 授权与同步接管。后段采用真实 factory + FlowClient + production App：一随机专用 PG、一 Chrome、动态端口；累计不超过 600 秒，包含启动/build，每轮至少预留 20 秒 cleanup，证据不超过 16 MiB。0 provider、0个人入口操作；不重复已审模块17/10或后端78全矩阵。真实 HTTP 覆盖 v1省略、v2实际附件/共享ACK、坏200 unknown原key/body恢复；实际App覆盖草稿/别名/双pane/隐藏/停用/关闭保护、storage失败纯文本、双主题390和键盘。精确源码与原始报告绑定，所有未知范围保留。

## TODO

- [ ] ATTACHI02-01：材料深冻结接入真实 Outbox/Queue 命令并验证兼容与 ACK。
- [ ] ATTACHI02-02：P01 私有授权附件 binding 与直接消费者测试。
- [ ] ATTACHI02-03：依法取得剩余范围，实际 App/Thread/CACHE 与 HTTP 旅程贯通。
- [ ] ATTACHI02-04：固定候选、独立 review、主线接收与 scope 收口。
