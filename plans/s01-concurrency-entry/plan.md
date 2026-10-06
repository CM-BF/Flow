# S01P02 Runner本地并发配置入口

状态：in-progress；阶段M2；owner architecture_read/gpt-6-astra；co-lead mika。小task，所属大task [FLOW-001](../flow-001-architecture/plan.md)；[S01前序](../s01-runner-capacity/plan.md)仅依赖关联，不造第三层。WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-concurrency-entry`，branch `codex/runner-concurrency-entry`，base `4391bbf9f1785212d098ef6aa1c01a0320a003d3`。

已授权小设计（brainstorming bounded）：新增单一纯解析接口，main在端点/配置读取和profile发布前验证，再把local limit传给native runRunner。复用已有pool，不新建scheduler、CLI框架或更改中心capacity。固定需求明确，不重复用户许可。

- [x] **S01P02-01** 省略环境变量默认1；`FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS`仅规范十进制整数1..16，拒绝空串/符号/小数/科学记数/空白/前导零/越界。
- [x] **S01P02-02** main明确传native maxConcurrentAttempts；A2A仅省略/显式1，非1先于端点文件读取及任何网络/profile发布拒绝；native非法也先拒绝。保持adapter初始化、signals与脱敏错误。
- [ ] **S01P02-03** Node24/pnpm9.15.4/Vitest4.0.18下显式parser+main公开启动路径mock行为、root严格局部noEmit；固定source manifest/commit，独立review与main集成分别记录。

精确scope仅main.ts、新concurrency-configuration.ts/.test.ts、main-concurrency.test.ts、本plan/evidence，见[原子receipt](../../docs/evidence/s01p02/claim-receipt.json)。不写runtime/configuration/execution-profiles。接口无状态/IO、1..16有界；main已有资源owner和错误清理不变，统一遵循[modular-design](../../AGENTS.md#modular-design)。

验收只证明入口参数与早拒绝；中心注册capacity独立，未部署、真实并发/混合负载/PG/provider未验，运行窗口另独审。唯一进度见[status](status.md)，独审见[review](review.md)。

2026-10-06 09:47:54 UTC：4源码已完成；最终64/64及root strict局部noEmit0，源码待冻结target交只读review。原red17/20、初始编译环境失败保留；无工程负载/PG/provider。
