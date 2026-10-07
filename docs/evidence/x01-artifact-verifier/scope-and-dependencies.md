# 后继 scope / owner 协调候选

下列都是**待授权产品候选**，本次 claim 只有计划与证据两目录，不得据此开写。账本只读快照见 owner-snapshot.json；新 take 前须再次全量核验，STOP→原 claim current-version amend→接收方 take COMMITTED。main 固定输入并不赋予其他 worktree 的写权。

## Slice 1：明确安装能力与结果合同

新 literal 候选：

- `packages/contracts/src/plugin-verification.ts`
- `packages/contracts/src/plugin-verification.test.ts`
- `packages/plugin-runtime/src/json-object-verifier.ts`
- `packages/plugin-runtime/src/json-object-verifier.test.ts`
- `apps/runner/src/plugins/verifier.test.ts`

现有 direct consumers 必须同时列入实际范围：`packages/plugin-runtime/src/package-store.ts`、`packages/plugin-runtime/src/package-store.test.ts`、`apps/runner/src/plugins/host.ts`、`apps/runner/src/plugins/execution.ts`、`apps/runner/src/plugins/execution.test.ts`。package-store/host 在本次快照未见 active literal覆盖，但仍须新take；execution两叶由 **PROCESS / db_transaction_owner claim8c2f0b78 v2** 持有，必须其已审片/T7安全交接，不覆盖待main产品。受信测试材料放本任务现 evidence 内，真实压包/import/invoke须另普通资源预算。

本片只允许安装式 verifier 真实有限行为+纯算法/合同，不能标生产领取已可用。有价值的独立验收：真实包A/B输出、假passed与中心函数不一致、自有key/数组/null/超限，旧tool材料直接消费者不变。配置/trust map的未来接线不能以仅未消费helper称交付。

## Slice 2：完整 center / runner 纵向

新增领域 literal 候选：`apps/server/src/plugin-runtime/verification.ts`、`apps/server/src/plugin-runtime/verification.test.ts`、`apps/server/src/plugin-runtime/verification-pg.test.ts`、`packages/contracts/src/verifier-runner-claim.ts`、`packages/contracts/src/verifier-runner-claim.test.ts`、`apps/runner/src/plugins/verifier-recovery.test.ts`。新增migration文件名/编号待 storage owner fresh协调，未保留号；不写034。

必须接真实consumer的既有 literal：

| 路径 | 当前 owner/原因 |
| --- | --- |
| `packages/contracts/src/runner.ts` | X01父 architecture_read，新增strict verification事件，不改变旧分支 |
| `packages/contracts/src/plugin-runtime.ts` | X01父，旧v1 DTO必须保持；新projection尽量新leaf |
| `apps/server/src/plugin-runtime/commands.ts` | X01父，安装kind/enable/admission与phase共享校验 |
| `apps/server/src/plugin-runtime/store.ts` | X01父，复用材料关联/当前资格，禁止双权威 |
| `apps/server/src/plugin-runtime/claim.ts` | X01父，SQL资格与锁后复核 |
| `apps/server/src/plugin-runtime/routes.ts` | 本快照无active覆盖；已main REMOVAL/HOST必须保留 |
| `apps/server/src/plugin-runtime/artifact.ts` | X01父，verifier产物身份/phase关联 |
| `apps/server/src/runners.ts` | CORE原claim已release；本快照无active覆盖，main新settings资格必须保留 |
| `apps/server/src/runner-claim-receipts.ts` | X01父，跨协议同key完整资格 |
| `apps/server/src/runner-claim-routes.ts` | X01父，新显式协议/旧兼容 |
| `apps/server/src/evidence.ts` | 本快照无active覆盖，foreign source只在新分支校验，不放宽旧同attempt规则 |
| `apps/server/src/events.ts` | X01父，中心完成门禁+同TX回滚，P02/steering/body不覆盖 |
| `apps/server/src/index.ts` | X01父，装配新的显式可信策略和原routes |
| `apps/runner/src/admission-journal.ts` | X01父，完整v4资格落盘/不降级 |
| `apps/runner/src/admission-plugin-claim.test.ts` | X01父，v2/v3旧journal拒升级/未知key保持 |
| `apps/runner/src/runtime.ts` | PROCESS db，复用现生命周期与终态恢复 |
| `apps/runner/src/plugins/runtime.test.ts` | PROCESS db，真实runRunner分派直接consumer |
| `packages/client/src/plugin-runner.ts` | X01父，唯一request端口+新协议decoder，无第二fetch |
| `packages/client/src/plugin-runner.test.ts` | X01父，完整ACK/unknown/abort |

所有候选范围按真实最终diff逐literal领取；不能因同agent持父X01就跨task同时写。新v4若确需修改已有 `packages/contracts/src/plugin-runner-claim.ts` 或其test，先由X01父精确handback；优先保持旧codec封闭并让公共router组合新leaf。不预先领整个server/runner/contracts目录。

动态SQL与迁移必须有真实PG：mixed queue LIMIT前过滤、ref/source FK/immutable与source漂移、同key并发、event整TX失败回滚、当前grant/phase/owner fence，不能用类型图或mock替代。现已main CORE settings隔离、C02/P02/native任务直接消费者在集成点做有意义组合，不重跑所有历史套件。

## Slice 3：启动/管理/只读公开消费

现有实际入口候选：`apps/server/src/plugin-runtime-configuration.ts`、`apps/server/src/plugin-runtime-configuration.test.ts`、`apps/server/src/main.ts`（X01父）；`apps/runner/src/configuration.ts`、`apps/runner/src/configuration.test.ts`（PROCESS db）；`apps/runner/src/main.ts`（X01父）；`packages/client/src/index.ts`、`packages/client/src/plugin-management.ts`、`apps/cli/src/index.ts`（快照无active覆盖，后继须fresh）；新增 `packages/client/src/plugin-verification.test.ts`、`apps/cli/src/plugin-verification.test.ts`。优先沿现私有配置/唯一FlowClient/CLI argv，直接消费固定server合同，不抢Web路径或contracts barrel。

产品任务详情已有reference读取可先证明typed结果可读；Web/TUI专属视图由现owner另核确切叶，此处不预领其 scope。完整用户接受必须看到指定源版本、规则/包版本与失败理由；只API通过不能勾父X01全部三端。

## 顺序与主线前像

1. 本设计先独审，仅docclaim保留。PROCESS当前已审但待集成/T7事实由其唯一status主导，不在此复制进度。
2. 产品进入时fresh currentmain与上述own/shared paths；旧X01父和PROCESS各自STOP部分literal→amend→本任务take，不release整个parent。
3. 第一片真实local；第二片固定operator+唯一PG；第三片真实启动/CLI/现consumer。每片必要差量独审及窄intake，不要求先全库重构或全局pluginframework。
4. registry/task登记/架构图由Execution Lead：本新增subtask唯一status路径见本目录plan，图目前仅planned，未经产品实现不画成main运行事实。
