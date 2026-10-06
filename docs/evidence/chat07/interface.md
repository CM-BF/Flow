# CHAT07 首合同

DTO：packages/contracts/src/active-steering.ts。正文保持原字节，非空/无NUL/合法Unicode且UTF8≤16KiB；轻列表只id/绑定/状态/字节/hash，不带text。授权正文入口绑定task+command，独立读取，不借通用detail猜正文。

候选公开路由（module不在生产mount）：owner POST /api/tasks/:id/steering，GET同路径状态、GET /api/tasks/:id/steering/:commandId/text、GET /api/tasks/:id/steering/audit；runner POST /api/runner/steering/receipts。现中心preHandler保持owner/runner角色；命令受理需显式测试/后继mount选项，默认关闭，不开conversation steer capability。

owner command {attemptId,ownerVersion,expectedRevision,text} + Idempotency-Key；返回稳定commandId/userMessageUuid/revision。每attempt一条accepted/received/unknown在途。收据phase为received/observed-consumed/rejected/unknown，带本command UUID/native session及expectedReceiptRevision；observed-consumed须root来源UUID/源类型和含本UUID的consumed列表。received不是SDK消费，observed-consumed是runner所报观察，不是模型遵从。

所有mutation先当前runner→task→attempt fence/live校验，再幂等重放；重放不越撤权/换代/失效lease。unknown不自动再发；当前attempt不可用时GET明确attemptAvailable=false，历史已记状态不改写为成功。审计追加且不可变。

sealForFinal(client,runnerId,{attemptId,ownerVersion,expectedRevision,final:{nativeSessionId,sourceMessageId,contentDigest}})是窄事务seam；调用者必须在同TX写final，失败一起回滚。未决/unknown拒绝seal，seal先赢拒后续命令；sealed结果同identity幂等、异identity冲突。首段不改旧events/SDK，因此该保护仅适用于明确调用seam的组合；旧生产final尚未接线。真实SDK/runner消费及公共client/export/mount由后继独占scope完成。
