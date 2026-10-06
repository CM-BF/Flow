# S01P07 独立审查

**SOURCE_REVIEW APPROVED / VALIDATION_PENDING。整体产品验收与 PG 窗口尚未开放。**

- Review target commit：83a0799293057f7472f0329c61e566708b2a2381（8 产品源限定）。
- Base：22a0806bc2465e11096949618113833f31766b19。
- chatui01_owner / gpt-6-astra，2026-10-06 20:48:19 UTC，0 P1/P2；只读，无测试或 PG。见[原回执](../../docs/evidence/s01p07/source-review-83a.json)。
- 核对 v1/v2 同 allocation/transaction/runner→task→attempt 锁序；compact receipt 原子性；unknown key 保留；journal assignment+nextkey 先于 adapter 与首次 heartbeat；正常 stop 迟到分配、expired、v1 unknown、restart 保守规则；严格 codec。
- 85 不同 non-PG 行为分批通过，focused strict 修后 0；三类历史失败保留。另3个纯 fake 检查只验证外层进程 EPERM/单次信号规则，不是 PG 业务检查。
- 中心真实事务/专库 8 组仍 NOT_RUN，PG fixture/监督准备待固定组合审，main NOT_INTEGRATED。不得把源审范围外推为完整产品通过。

## Findings / 回应

进行中预核的当前 lease 整数兼容、旧 peer UUID 和私有资源所有权/primary 错误保留已修正并分别记源与检查。真实 PG 结果尚无，整体 review 仍待其证据；修复与复审按固定提交，不覆盖原 raw。
