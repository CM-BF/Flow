# S01P04 runner 共享授权读取锁

状态：accepted / 准备中，2026-10-06。所属大task：[FLOW-001](/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/plans/flow-001-architecture/plan.md)，co-lead mika，owner status_read / gpt-6-astra。追溯S01-06与固定混合负载结果339147cb；它不是第三层父task。

目标是在不削弱revoke/owner/lease fence的前提下，允许同runner不同attempt共享稳定授权读取锁。只改ownedAttempt第一步；公开lockRunner、claim/容量、maintenance/profile/revoke和外层goal/protocol强锁继续独占。具体Module Interface、资源/错误/取消/锁顺序及测试矩阵见[interface](../../docs/evidence/s01p04/interface.md)，遵循[根modular-design](../../AGENTS.md#modular-design)。不扩pool、调度器，不改已封存S01结果，不作性能提升或容量SLO结论。

工作树 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-read-fence`，branch `codex/runner-read-fence`，base `c450c2da7e6185b88db9f46e0299ee504ee6f3e8`。当前三scope仅计划/证据/新测试；runners.ts仍由ENG01B owner持有，必须等明确停写及原子移交，继承其稳定源后才能实现。

## TODO

- [x] **S01P04-01** 固定小Interface、共享/强锁调用矩阵、maintenance与revoke区别、测试seam及合法移交请求。
- [x] **S01P04-02** 准备专用随机PG库交错测试；原实现真实red，不执行旧固定共享库fixture。
- [x] **S01P04-03** 原owner ready后合法amend取得runners.ts，保留其固定源，最小共享fence red→green。
- [ ] **S01P04-04** 完成同/不同attempt、revoke/drain/hold/claim与强锁嵌套代表检查、必要直接消费者及strict；固定证据和独审。
- [x] **S01P04-05** 修复复审与受控main集成，确认权威status/架构影响同步；剩余完整未知claim恢复不混为本片完成。

技能find-skills本地优先，选brainstorming bounded、codebase-design、clean-code、tdd；路径/hash与实际方法见[skills](../../docs/evidence/s01p04/skills.json)。Mika已同意文件内私有helper，避免为两条SQL制造模块或向caller开放任意锁模式。0新增混合窗口，0provider/nativeSDK；实际验证数只能按原始输出记录。
