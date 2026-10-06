# WPF-ACTIVITYI01 聊天活动接线

创建/更新：2026-10-06。状态：in-progress。唯一 owner：w01_owner。父需求是已授权 U11 聊天活动展示，沿用[工程管理计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/plan.md)，不新建共享协议。

## 目标与已批准边界

在官方 Thread 每轮稳定用户消息锚点展示可插拔活动 footer，接通已存在的原生工具/思考记录与通用任务事件。初始与折叠时不读取列表或正文，展开后只按需读取。只有 provider 实际记录才显示思考；没有伪造 streaming、持续时间或完成状态。

固定输入 86a36eaeffbf09f0a3772c3d1509c17dc0a76f92。本工作树 codex/web-conversation-activity-integration。精确17范围见[领取回执](../../docs/evidence/wpf-activity-i01/take-receipt.json)。现有通用活动模块61b、会话projection/messages/queue/shared/rootmanifest/rootlock只读，不消费CHAT06 stream，不新增依赖。模型派发 gpt-6-astra / ultra；不调用真实模型或产品数据库。

## 方案与接口

原生projection独立负责分页轻header、当前展示页有界元数据刷新、正文缓存及身份/迟到响应校验。after是活动ID对应顺序，不按hash或跨attempt sequence排序；任务更新合并刷新当前页，不自动排空历史，其他页标陈旧并显式回看。详情走nativeActivity，仅展开读取最多64KiB UTF-8前缀；截断JSON回退文本，sha只标识完整原文。

Tool采用固定官方AI Elements最小组件；Reasoning复用现assistant-ui，streaming=false且无duration。单一footer承载通用/native展示；P01增加typed chat.message.footer slot、task.activity.read能力，实际挂载button/menu/panel。授权绑定connection/view/conversation/message/turn/task，非焦点split也使用自身上下文。原App native hidden显式visible驱动读取lease，保留合法缓存与展开状态；真正close/换中心使旧口同步失效。不会另建插件启用或授权事实源。

## TODO

- [x] ACTIVITYI01-01：实现有界原生活动projection及Tool/Reasoning展示，验证身份、分页、状态和截断。
- [x] ACTIVITYI01-02：官方Thread footer接P01三类贡献与宿主read ports，保留发送/队列语义。
- [x] ACTIVITYI01-03：局部和实际App HTTPfixture验证双主题390、键盘、懒读与隔离。
- [ ] ACTIVITYI01-04：固定候选独立review、修复与Lead主线接收。

## 验收与风险

局部测试覆盖当前页刷新/旧页陈旧、跨attempt顺序、正文身份/字节/错误/取消缓存、permission/visible/epoch；实际App覆盖pending/running用户锚点、两split、native hidden恢复、折叠0请求、hasMore显式分页、队列草稿不回归。dev StrictMode+Activity单独列，不能用它代替native hidden事实。0模型fixture不等真实中心/provider验收。每工作段/约30分钟安全停点/交付应用clean-code。

架构影响：新增宿主活动read port及typed footer slot，固定候选后由Lead协调架构图更新。独立review默认NOT_STARTED。

2026-10-06 07:09 UTC：实现固定e93070c，精确消费已审C03两文件输入889f→07da10c；未改变其内容。局部74、dev11与typecheck/build通过，production10组合通过，独审NOT_STARTED。
