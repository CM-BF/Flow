# S01P03 正常停止领取与有界排空

状态：方案准备，2026-10-06。所属大task：[FLOW-001](../flow-001-architecture/plan.md)，co-lead mika，owner status_read / gpt-6-astra。S01 是前序实验，不作为第三层父任务。

目标：已发 claim 的明确响应可在正常停止时按原 deadline 收束，避免已结束所有 attempt 后的正常空轮询产生不必要的未知占用；真实未知和已受理 assignment 必须继续保留。输入为已独审 S01 FAIL 结果 `6a5961a0d815113bba7cea149bc08ca07fdd128a`，原始证据在 runner-capacity-probe 权威树 `docs/evidence/s01/mixed-run/`。

方案及 Module / Interface / 生命周期见[接口页](../../docs/evidence/s01p03/interface.md)，遵循[根 modular-design](../../AGENTS.md#modular-design)。只读已确认原 `runtime.ts` 将 normal stop 与 fatal shutdown 合成一个 signal，并传给 claim；本片优先分离 claim 的取消来源，复用既有 journal、pending requests、AttemptControl 与 outbox。

固定 base `f181d84b5fb3652d62e2a181acff442d42b3e066`；worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-graceful-stop`，branch `codex/runner-graceful-stop`。精确 scope：`apps/runner/src/runtime.ts`、`apps/runner/src/runtime-shutdown.test.ts`、`plans/s01-graceful-stop`、`docs/evidence/s01p03`。不改 main/client/server/contracts，不做 PG/provider/mixed 负载。

## TODO

- [ ] **S01P03-01** 固定短 Interface、取消来源/late non-null/未知边界与测试 seam，经 Mika 审定。
- [ ] **S01P03-02** 公开 runRunner loopback 用例先复现延迟 null 跨正常停止故障，保存 red；最小修改后 green。
- [ ] **S01P03-03** 验证 late non-null 持久不执行、原 deadline 不刷新、丢 ACK/非法响应/强停保留、无第二 claim，以及原活动执行/fatal保护。
- [ ] **S01P03-04** 局部直接消费者与 strict 检查；固定 source/raw/hash、clean-code 记录及独立 review。
- [ ] **S01P03-05** 修复复审后交 Lead 集成，明确 main target 与仍未实现的完整未知恢复；不补原 B 窗口。

验证仅用有界私有 loopback HTTP、fake adapter、临时 journal/自有 child，不跑实际 PG。runner.test 全量、runtime-capacity 中非 real PG/HTTP 的原消费者及 strict noEmit；四个 PG 参数实例保持未运行，不删除或改写其断言。计数以真实选中结果记录，零测试不算通过。测试生命周期须 finally 关闭自有连接、child和目录；无关工程测试不跑。

技能：本地 find-skills、brainstorming（bounded短方案）、codebase-design、clean-code、tdd；固定文件来源/hash与应用方法见[技能记录](../../docs/evidence/s01p03/skills.json)。不重复安装。接口方案待审，不提前修改 runtime/test；计划/状态按仓库要求先建立。
