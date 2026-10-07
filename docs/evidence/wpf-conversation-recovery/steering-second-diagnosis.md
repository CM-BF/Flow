# Steer草稿丢失观察后的固定源码诊断

2026-10-07 10:04:43 UTC；固定 `a8e8aa3eba74abe400b3cbd9d4788d8e9d63d90e`（browser diagnostic），其产品源逐字同54952。仅只读源码/原actual，未更改产品、未运行第三次。原RECOVERY01-02/03/05，完整feature IN_PROGRESS。

## 实际与下游链

- actual inputMatches=true；对应route draft version4.steering=[]，0SteerPOST，首draft predicate超时。有限alerts仅在失败观察时为空，不能概括全程。
- `apps/web/src/conversation-steering/SteeringControl.tsx:19,37`：controlled draft经onDraftChange；`apps/web/src/plugin-integration/steering.tsx:110–111`：setDraft先改entry再publish/changed，drafts按viewKey/非空返回原task/turn/message/text。
- `apps/web/src/App.tsx:660–663`把该完整数组交recoveryValue；`apps/web/src/recovery/binding.tsx:194–201` changed捕获全draft，若state.handoff存在只放deferred。这个分支不产生错误alert。`endHandoff:226–230`才释放deferred并enqueue。
- `apps/web/src/recovery/journal.ts:194–206` saveDraft保存完整data；fixture observer:53直接传read.result，没有strip steering。没有发现下游字段过滤能解释本次空数组。

## 可达生命周期候选（根因尚需针对验证）

`App.tsx:494–523`长期hashchange effect只有[client]，followRoute闭包调用当次render的select→ensureView；`App.tsx:810`初始session=null。`ensureView:463`仅session存在才给新ConversationProjection配置recovery；`App.tsx:825–831`补绑effect仅依赖session/authorized/generation。初始视图能在session到来后补绑，但稍后同页hash导航若仍调用初始closure，新projection可能没有recovery。

本journey browser:712把同fixture URL切到新#conversation。`ConversationThread.tsx:178`已在当前session beginHandoff；projection.ts:315–319则捕获可选recovery，缺失仍可发turn202。没有prepare，就不触发binding原commandPort prepare/endHandoff；后来Steer changed只进入deferred，正好允许UI有文案、IDB旧draft无steering、无command record和无错误。以上是静态可达链与实测形状一致，未把内部handoff/recovery存在性当已观测值，也未排除所有其他原因。Root独立核App/session支路。

## 最小后继建议与回归

1. 在原App私有生命周期让长期route listener调用当前render的select/newChat（例如复用本树actionsRef同型私有ref），确保新view用当前Recovery session配置；保持原projection/controller authority。不要把session直接加入当前大effect dependencies，因为cleanup会dispose所有view/catalog/profile。不改共享合同或创建新store。
2. 复用现steering-recovery同页hash导航，保第一次真实Send→Guide→完整原五秒草稿断言，不使用reload/remount绕开。可在原turn202后先精确核该turnKey对应唯一accepted outbox记录/原frozen.request/ACK turn+task；这样durable hookup断言直接暴露before-Steer缺口，不能仅以HTTP成功代替。
3. 在原conversation-recovery.test.ts内选择实际owner/route-binding seam的定向受控回归，需先确定最小实现接口；仅mock host.draft或镜像一个路由回调不能证明App listener捕获已修。真实browser再验仍不可省；原full7/50等旧绿不重跑。
4. 该候选涉及产品生命周期，先root集中确认source delta再执行，当前**未实现**。本60sphase已不足最小30s，不复用剩额或旧封账credit；后续实际必须明确新的有限预算/资源交接。仍不证明真实native消费/应用，也不覆盖第二中心。

本地find-skills/clean-code/codebase-design按既有安装方法复用：区分观察器与authority、原错误和诊断错误、保存事务与UI展示；无安装/新测试/服务。
