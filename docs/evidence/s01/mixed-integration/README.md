# S01 mixed完整已审输入：受控集成入口

Owner status_read/Astra；唯一WT runner-capacity-probe / branch codex/runner-capacity-probe；原三scope writer8e4660a6 v3。此页仅解决主线缺整个mixed目录、不能只接observer两文件的问题；不运行测试/负载或复制raw，不表示新A/B门禁开放。

**接收26个源文件：**以固定 `6de928d8092ba8c22ac2222ac7c16af3660be48a` 的完整26source/config/README/tests为基础，仅将 `experiments/runner-capacity/mixed/observe-pg.ts` 和 `observe-pg.test.ts` 替换为独审 `c259e8e53cd53830fe1bc78ce3c8dae7b34d5540`。最终仍是26路径。[精确路径、字节、SHA和逐文件来源](source-selection.json)已离线核Git=当前WT；它不是把两个source单独当成完整driver。

| 审批链 | 固定入口与范围 |
| --- | --- |
| 完整准备source6de / packetffee77 | [manifest](../mixed-128-preparation/manifest.json)、[独审](../mixed-128-preparation/independent-review.json)：Mika/Astra 2026-10-06 12:29:56 UTC APPROVED，26source+27readonly+42raw+10support、41distinct纯checks/strict0；准备批准本身不授权实际执行。 |
| 一次实际execution70c / result64911 | [接收页](../mixed-128-run/integration-ready.md)、[manifest](../mixed-128-run/manifest.json)、[独审](../mixed-128-run/independent-review.json)：Mika/Astra 12:37:14 UTC限定APPROVED固定64911a3c88488dfdebaa3a678bad659211e29209，128fixture tasks/attempts/持久sessions、ACK/采样/清理真实；不是nativeSDK/SLO或小时驻留。历史FOR SHARE elapsed仍UNKNOWN。 |
| 两observer覆盖c259 / packete082 | [接收页](../observer-share-fix/integration-ready.md)、[manifest](../observer-share-fix/manifest.json)、[独审](../observer-share-fix/independent-review.json)：architecture_read/Astra 12:45:30 UTC APPROVED，16bindings、4/4fake direct+strict0，0新capacity，不回填64911的UNKNOWN。 |

历史manifest里的source/raw/readonly均按其fixedGit解释，不能把最新两源覆盖后的WT或当前main冒充旧证据输入。原16/32阶段的manifest/raw亦原样留在各自目录；不用为集成复制/压缩/重写那些证据或重新跑容量。当前源码选择表与历史完整26表同时保留，避免丢失重现来源。

集成时必须核直接imports和消费者：mixed child动态消费server createServer、runner runRunner/fixture以及@flow/contracts；driver/process依赖既有同目录上一层http.ts/processes.ts/evidence.ts，tsconfig继承root。source-selection附这三项及27readonly的固定观察，**不是授权回滚主线生产依赖**。本次观察main `cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd`，27历史readonly中漂移4项：`apps/server/src/runners.ts`、`packages/client/src/index.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/runner.ts`。即使当下某项相同，也须Lead在实际集成点fresh核来源/类型与必要直接消费者；原main1c输入不能替代当前main。适配新的生产输入或A/B profile必须另源固定/审查，不能为了让旧preflight通过悄改旧合同。

当前main接收receipt未到；源码/raw冻结，owner保留writer。正式source合入只代表工具可用，不触发任何实际窗口。P05独立生产候选另见[正式ready](/Users/citrine/Projects/AgentHarness/Flow-worktrees/event-state-persistence/docs/evidence/s01p05/integration-ready.md)。
