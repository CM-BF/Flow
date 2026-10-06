# CHAT08 首DTO / ports

公共active-steering.ts新增类型：SteeringMailbox、SteeringResultObservation、SteeringFinalizationInput/Result、SteeringProposalLookup/Status。runner.ts新增runner event steering-receipt / steering-result，及steeringFinalizationSchema（原有3个final artifact/verification/assistant-final事件）。HarnessContext.steering可选，生产默认不绑定。

- POST `/api/runner/steering/mailbox`，Ownership → SteeringMailbox。fresh当前runner/attempt/lease/session授权；最多64条轻commands，只有唯一accepted正文按需附delivery，received/unknown不回正文/不重投。
- POST `/api/runner/steering/finalize`，SteeringFinalizationInput → SteeringFinalizationResult。committed或明确not-committed；网络不确定由host表为unknown，不伪造成server拒绝。expectedRevision/afterSequence、resultId/native session与3事件在同TX核验，先seal再现真实applyEvent，回滚整体。只有成功保存幂等receipt；竞争失败不占outbox序号。
- POST `/api/runner/steering/proposals/status`，SteeringProposalLookup → SteeringProposalStatus。只查同runner当前ownerVersion proposal receipt，不变更工作；允许当前attempt已完成/lease过期后查已提交事实，但不允许旧owner/撤权读取，absent不等于请求绝不会晚到。unknown时仅重报原proposal，不根据一次absent创建不同candidate。

Shared client建议steeringMailbox(ownership,signal?)、finalizeSteering(input,signal?)、steeringProposalStatus(input,signal?)。全部signal/bounded request，无隐藏语义retry。

条件final需最多64条command的累积result覆盖前沿、最新成功result queuedTurnCount明确0、没有accepted/received/unknown。首帧消费不能替代result覆盖；较早success覆盖保持，最后result不用再列全部历史UUID。源result metadata沿现outbox/审计持久，body仅候选final事件；可复用flow.commands及immutable steering_audit，无必要则不加025。

outbox普通flush到proposal期序号冻结；普通emit拒绝/等待明确由runner调度，heartbeat继续。candidate本地持久，HTTPunknown只确认原bytes；not-committed安全解除冻结继续当前query，committed更新prefix后结束输入，SDKclose后runtime sole completed。中间result不交artifact/final/completed，累计modelUsage不相加；query级deadline/SDK budget不随result重置。cap false；注入SDK链通过也不冒充provider/UI能力。
