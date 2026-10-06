# WPF-PERF03 消息对象复用

创建：2026-10-06。状态：in-progress。Owner：w01_owner / 派发gpt-6-astra ultra。父需求是减少未变化会话刷新的重复转换工作，管理入口为[Web平台计划](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/web-platform/plan.md)。

## 已批准范围与方案

固定base 30b97cbf3665c4ef7a314a6a8b59394ae68781af，独立codex/web-message-reuse。仅[领取回执](../../docs/evidence/wpf-perf03/take-receipt.json)五scope；不写App/Thread/projection/stream/shared/根依赖，不新增模型调用或服务。

conversationMessages接口保持现状。按不可变ConversationTurn对象身份WeakMap缓存纯展示消息对，不按turn ID/revision/text全局强缓存。每次仍按输入顺序构建数组；新turn对象重建其消息，状态/正文/截断/source变化不会被旧缓存覆盖。缓存不持有client、draft、授权口或projection；相同ID的不同连接对象不能命中同一项。现有Thread稳定converter与动态adapter不改。

## TODO

- [x] PERF03-01：实现弱引用消息复用，保持现有内容、ID、日期及懒详情标记语义。
- [x] PERF03-02：局部真实projection行为与实际core小计数，证明复用及动态更新；保留失败记录与精确版本。
- [ ] PERF03-03：独立固定review、修复及Lead主线接收。

## 验收与限制

必须覆盖same-revision pending→final/正文变化、truncated/source版本变化、分页/顺序、task状态和core自动尾status、新中心同ID隔离、草稿与final分离。用现安装core0.3.22纯内存100turn/200messages的小计数；只报告对象identity与converter调用，不能推断React渲染次数、用户延迟或内存无泄漏。保持O(n)数组遍历，不新增缓存框架；数据输入/输出不可原地修改的契约明示。每段/交付clean-code，metadata不重复产品测试。

架构影响：仅原消息展示转换函数内部缓存，不改变模块公开接口/协议/FSM/DB，无需架构图改造。

2026-10-06 07:31 UTC：固定f909d32f5fcff5b0ac6408dc96e8630bfeffae4e，3文件实现；最终8+此前77局部/typecheck通过，小计数证明未变200条复用且实际converter回调200→0，变化末轮仅2；不等于runtime/React工作为0。独立review NOT_STARTED，主线未接收。

2026-10-06 07:37 UTC：root固定f909独立APPROVED，实际8/8通过、0 findings。PERF03-03仅审查部分完成，main接收仍待Lead，保留未勾选；交付阶段integration。
