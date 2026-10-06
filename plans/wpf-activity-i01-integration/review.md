# WPF-ACTIVITYI01 独立审查

**状态：CHANGES_REQUESTED**

Review target commit：e93070cc08339325cd299105f5805ca871a07ea8

Base：86a36eaeffbf09f0a3772c3d1509c17dc0a76f92

## 审查入口

在web-conversation-activity-integration核branch/HEAD/dirty，按[status](status.md)实现范围只读审查固定提交。核完整消息/轮次/任务/连接身份、native当前页刷新与懒body、P01唯一生命周期、官方Thread内部footer及三类贡献、实际native hidden和split行为。检查fixture与真实中心边界；禁止将空模板当通过。

## 已执行 / 未执行

尚无独立review结论；作者74局部/typecheck/build/dev11通过，production10通过，最终17文件hash与目标相同；计划见[plan](plan.md)。Findings、修复提交及复审结论将在固定候选后据实记录。

## ACTIVITYI-R1 · P2 · OPEN

root独审e930发现：adapter未把conversation connection=disconnected纳入read lease；离线后同turns引用展开仍nativeActive=true并发出读取。generic setOnline未接、native flight也未取消。要求offline展开零读、飞行请求取消及迟到隔离、重连与隐藏/草稿回归。此为确认blocking，作者正在原scope修复，旧检查未覆盖该行为。
