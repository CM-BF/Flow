# S01P05：合并事件任务状态写入

创建/更新：2026-10-06 12:40:42 UTC。状态in-progress（metadata已开工，生产待路径移交）。所属[FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)，co-lead Mika；从原S01-06后继追溯，不建立第三层任务。遵守[根模块规则](../../AGENTS.md#modular-design)。

目标：保持事件事务、fencing/replay/rollback和最终task语义，将同一persistEventState内三个task UPDATE合为一个，验证精确写次数/行为。方案及Module/Interface、trigger、directconsumer、scope/生命周期见[唯一接口页](../../docs/evidence/s01p05/interface.md)。当前无池大小/缓存/通用框架/schema/轮询改动，不声明性能改善；A/B另需固定输入与实际门禁。

## TODO

- [x] **S01P05-01** 固定main输入、调用影响和最小Interface；metadata领取/权威登记请求。
- [ ] **S01P05-02** F01停写并移交events.ts；本claim追加两个生产/test路径成功。
- [ ] **S01P05-03** 最小red→green实现，保留公共接口/错误与锁顺序，完成clean-code自审。
- [ ] **S01P05-04** 专库功能等价/写次数/rollback/finalization与局部strict，保存所有raw/cleanup/固定source。
- [ ] **S01P05-05** ≥Sol独立固定commit review与Lead main接收，分别记录，不用分支通过代main。

风险：immutable triggers按列触发必须保持固定列；undefined/null值不能被默认转换；accepted0不能更新；finalization跨多表状态须完整回滚。当前阻塞责任F01/Lead路径移交，解除为停写+amend移除+新claim追加COMMITTED；可独立完成metadata及原S01 observer fake修复。

新source未实现、真实PG未执行、未来A/B未OPEN；本计划不会改变旧S01已封存128结果。
