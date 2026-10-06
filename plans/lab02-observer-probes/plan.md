# LAB02 本地观察者诊断

| 字段 | 内容 |
| --- | --- |
| 计划编号 | LAB02 |
| 状态 | `in-progress` |
| 创建日期 / 最近更新 | 2026-10-06 / 2026-10-06 |
| 父计划 | [FLOW-003](../flow-003-m1-execution/plan.md) |
| Owner / model | runner_owner / gpt-6-astra |
| Worktree / branch | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/observer-probes` / `codex/observer-probes` |
| 基线 | `6434fba78bba5097376555a66114462f5432ca25` |

目标：用真实本地 center、独立 PostgreSQL 数据库和 HTTP SSE，直接测量 1、16、128 个观察者对相同任务/事件的短样本读取事务、SQL 提交量，以及 heartbeat、一次控制操作的延迟与事件正确性。不启动模型；既有真实 query 预算 5/5 已用完。

## 已确认范围和方法

仅写 `experiments/observer-probes/**`、本计划三文件、`docs/evidence/lab02/**`。新建专属 `flow_lab02`，动态 loopback 端口，绝不清理 `flow_i01` / `flow_c01` 或干扰 4320 dashboard。总 benchmark 时间不超过 2 分钟，数据不超过 64 MiB。运行结束清理本次创建的数据库与 server。

一份固定任务和固定事件数据贯穿所有观察者数量；分三轮平衡顺序，关闭前组后再开下一组。SSE 追齐后做短稳定采样。toy 脚本内包装 pg Client 的 query 提交点，按数据库和测量窗口计数，只记录计数、不记录 SQL 参数或凭据。heartbeat 测 HTTP 往返；控制操作取消独立 queued task，以保持观察任务不变。保存原始样本与正确性断言；heartbeat 注明 N 后报告 p50/p95，控制操作仅三次，直接列原始值和范围。pool 等待未测，不从延迟反推。样本量小、本地共享主机有噪声；无 SLO、模型并发或容量结论。无需优化实现、broker 或产品 API。

## TODO

- [x] **LAB02-T01** 独立 worktree、技能核对、计划与资源边界。
- [x] **LAB02-T02** 最小有界诊断脚本、隔离与清理、类型检查。
- [ ] **LAB02-T03** 1/16/128 观察者短样本、直接测量与事件一致性证据。
- [ ] **LAB02-T04** 限定结论、clean-code、状态和可审查提交。

验收以 [status](status.md) 与 [证据](../../docs/evidence/lab02/README.md) 为准；独立 [review](review.md) 初始 NOT_STARTED，分支通过不表示 main 集成。全局索引由 Execution Lead 维护。
