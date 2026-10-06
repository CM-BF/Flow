# M02 跨批次因果顺序修复

2026-10-06 02:26 UTC，Execution Lead / gpt-6-astra ultra。范围仅 workspace 投影与真实 PostgreSQL 行为回归；沿用本地 find-skills、codebase-design、clean-code，未安装依赖或调用模型。

Goal Owner 源码检查指出：accepted 每次最多 200 个，而 timeline 原先可从未投影 accepted 的其他 task 中取出输出。因此第 201 个 task 的输出可能早于受理事件得到 workspace cursor。

先加 201 个真实受理任务的 HTTP/PG 回归，第 201 个有一条输出。旧实现首次 watermark=201，预期 200，测试失败（1 failed / 5 unselected，1.43s）。随后 timeline 查询只连接已有 task_cursor=0 的受理投影；同一事务能看到本次新增的 accepted，两个 SQL 间才提交的新 task 会等下一轮受理。修复后 workspace 模块 6/6 通过，4.15s；覆盖原双事务晚提交、并发投影、双向分页、10项决策、task index 与本次202条完整/唯一/因果顺序检查。

命令：`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/m2-workspace.test.ts`，独占本机 flow_m02，动态 HTTP 注入；未跑全库。clean-code 复核保留一个 SQL join 表达不变量，无新增公共接口或抽象。该变更待独立 delta review，既有 M02 approval 不自动覆盖它。

## 独立复审

2026-10-06 02:29 UTC，assignment_review / gpt-6-astra：APPROVED target `b3ffd9730f96cb25852880aed3dd30a808ab9f67`，base `108fddbd8261963f3d49088873b5a611b70a5dbf`。核对 acceptance 唯一键防重复、同事务可见性、原投影锁与晚提交语义；独立选择201 task与late source commit两条真实PG用例2/2通过，4条未选择。未跑全库/模型；无blocking。
