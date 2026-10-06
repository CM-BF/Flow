# G01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新时间 | 2026-10-06 02:50 UTC |
| 单一 status owner / model | runner_owner / gpt-6-astra |
| Branch | codex/project-graph |
| Worktree | /Users/citrine/Projects/AgentHarness/Flow-worktrees/project-graph |
| 工作基线 / HEAD | base 8c57f2f97345167207fa0d2590e9ad6310c922d4；实现 HEAD 6394afad2480da369adb7e6156403bfc45097dfa；其后仅本任务 metadata |
| 工作树 dirty 状态 | 实现已冻结；本次交付提交仅计划和已生成证据，提交后 clean |
| 工作分支状态 | completed（首片段）；独立审查通过，待集成 |
| 检查状态 | PASSED 6394afad2480da369adb7e6156403bfc45097dfa；公开 HTTP/PG 10/10、全库 typecheck、diffcheck |
| Review | APPROVED 6394afad2480da369adb7e6156403bfc45097dfa；Goal Owner 独立只读审查 |
| 已集成 main 状态 / HEAD | G01 未集成；基线 8c57f2f97345167207fa0d2590e9ad6310c922d4 |
| 阶段 | 动态计划 |
| 优先级 | 1 |
| 当前产出 | 项目计划图命令已通过独立审查，等待接入主线 |
| 下一可用交付 | 项目命令的中心与 CLI 接入（由 Lead 集成） |
| 当前阻塞 | NONE |
| 需用户决定 | NONE |
| 实现目标 | 6394afad2480da369adb7e6156403bfc45097dfa |
| 实现范围 | packages/contracts/src/projects.ts, apps/server/src/projects/, packages/storage/migrations/004-projects.sql |

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| G01-T01 | completed | runner_owner | 3b4832f 小合同已交 Lead，typecheck 通过 |
| G01-T02 | completed | runner_owner | 真实两条等待事务仅一方提交；另一项目同步推进；刷新后环拒绝 |
| G01-T03 | completed | runner_owner | 10/10 包含跨项目并发唯一绑定、不可变历史、重启/鉴权、200 节点/2000 边上限；后续 gate/取消传播 open |

## 边界与下一步

只建计划图，不自动提交任务或调度；不新增任务执行状态副本。依赖 gate、运行中版本失效决策、取消传播仍 open；本片段不能代表完整 O01。预算仍 0 模型调用，R02 总 5/5 不动。

作者证据见 [README](../../docs/evidence/g01/README.md)。Goal Owner 对固定 target 6394afad2480da369adb7e6156403bfc45097dfa 独立只读审查 APPROVED；核验 f9ea132c787b73a04929eee91a6d65defab16657 clean 且源码零差异，完整读取合同/实现/迁移/10行为测试/公共事务工具，没有 blocking findings，未重跑 tests。批准不包含共享 client/CLI/生产挂载、调度 gate/失效/取消传播、多租户或模型能力；详见 [review](review.md)。专用 flow_g01 已由成功测试清理；未触碰 4320、flow_i01/flow_c01。主入口/client/CLI 由 Lead 接线与全检；本任务 ownership claim 保留直到集成，当前不宣称 main 已具备。

唯一状态源即本文件，已通知 Lead 登记；本轮未亲自查询 dashboard 聚合结果，不能声称已展示。
