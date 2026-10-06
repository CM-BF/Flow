# SVC07 独立审查

状态：**NOT_STARTED**。设计已由 architecture_read 于 2026-10-06 19:44:42 UTC 在固定 main22a 只读审查，无设计 P1/P2；尚无实现审查结论。

- Base：22a0806bc2465e11096949618113833f31766b19。
- Source target / 检查 target：`e28c4ed0a30ec2800eeca2ca5c444c0081c38165`；[原始证据](../../docs/evidence/svc07/checks.md)。
- Scope：`apps/server/src/database.ts`、`apps/server/src/database-transaction.test.ts` 及本计划/证据。
- 验收：见 [plan](plan.md)；实际阶段及证据见 [status](status.md)。

## 只读审查任务

在本 worktree 核 branch/head/dirty 与规则，绑定完整 source SHA 阅读 diff、fake 和原始检查输出。重点检查 callback acquire 期间 error 覆盖、回调未完成不 release、主错误身份（含 null/undefined）、COMMIT ACK/未知区分、ROLLBACK/释放错误优先级、同步交给下一 borrower 时只移除自身 listener、一次释放及无业务重执。复用本地 find-skills / codebase-design / clean-code。默认不写源码或运行 PG，把 findings 回 owner；空模板与设计审不能作为 source approval。

## Findings / 结论

未审查，P1/P2 未评估。首片 fake 不证明真实 PostgreSQL 断连、HTTP 生存或物理关闭；真实消费者、main集成与架构基线更新单列。
