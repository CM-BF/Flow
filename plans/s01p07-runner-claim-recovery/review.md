# S01P07 独立审查

**NOT_STARTED。尚无产品实现或运行检查批准。**

- Review target commit：待固定。
- Base：22a0806bc2465e11096949618113833f31766b19。
- 权威 WT/branch/owner 见 [status](status.md)；scope 以 COMMITTED receipt 为准。
- 验收：空回应不持久写；同 key 唯一分配；只读 missing 不清未知；runner 身份绑定；v1 保守兼容；当前 lease 与 pre-adapter ownership；正常 stop 排空及 fatal 原错误保留；原任务/profile/goal/session/cancel/maintenance 规则不变。
- 检查：NOT_RUN。无 PG、provider、容量或 native 调用。

## 可复制审查任务

只读核对本计划、接口、scope、固定 Git target 与实际 WT/dirty。检查原 v1 与新 v2 共用分配 SQL，nonnull compact receipt 与 attempt 同事务，日志 accept(expectedKey) 的持久原子性，跨 runner/key/legacy journal 及过期回执的保守处理；逐项核对直接消费者和真实检查原件。不得重跑未授权检查或写 owner 树。提供绑定 target 的具体 P1/P2、行号、触发顺序，或范围限定的结论。

## Findings / 回应

未开始独立 review；无 findings 不代表无缺陷。修复与复审另绑定提交。
