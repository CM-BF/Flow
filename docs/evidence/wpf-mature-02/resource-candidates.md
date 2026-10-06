# Lead资源候选：有界只读核对

2026-10-06 16:07:03 UTC。本owner仅核三个既有完成树；X01用Mika转交的独立核验。没有全盘/进程扫描、运行检查、删除、稀疏化或Git配置写入；实际回收0B。只供Lead唯一Git operator fresh判定KEEP或可逆收起，不是本owner执行授权。

**KEEP：** `claude-codex-capabilities`（父claim0dd v6 ACTIVE，诊断候选/完整02/canonical仍开放）及 `claude-message-settings-core`（产品实施/共享依赖）必须保留；不触活跃依赖或旧raw。

## 三个已main且released的候选

共同现场：HEAD clean；`core.sparseCheckout`未设置，无`info/sparse-checkout`，index skip-worktree条目0。仅证明当前未稀疏，不能从配置缺失证明历史从未稀疏；原owner未报告曾执行sparse，Lead操作前仍核自身历史。未扫描全局反向依赖，因此没有“所有外部消费者均不存在”的声明。

| WT（均位于 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/`） | 固定HEAD / branch | 已知交付与fresh账本 | 保留/恢复闭包与外部消费边界 |
| --- | --- | --- | --- |
| `stream-ui-acceptance` | `c801586148b354f07429aec0ef4a96cb618f02fe` / `codex/stream-ui-acceptance` | 零模型准备已main2c6df475；CHATUI01 claim f412ea19 v2 released，11:46:25.849Z；3671 tracked index entries | 保留 `plans/chatui01-stream-acceptance`、`docs/evidence/chatui01`、`experiments/stream-ui-acceptance` 及原ignored证据。固定fixture从Git7106 archive Web/client/contracts，不依当前整树源码；显式FLOW_DEPENDENCY_ROOT向外借已装依赖。顶层/runner/server node_modules不存在。历史Chrome/Vite/HTTP关闭据已封存检查；真实模型验收未授权。dashboard和父文档仍读metadata。 |
| `runner-read-fence` | `064183b984f0dd7bc6818ef84e68dbc9e4fc5de7` / `codex/runner-read-fence` | 已main2f4a5789；S01P04 cb7db4a9 v4 released，12:00:01.946Z；5306 tracked index entries | 保留 `plans/s01p04-runner-read-fence`、`docs/evidence/s01p04`。产品/检查已从固定Git接主线；再次运行需恢复implementation/consumer manifests闭包（runners、events/index、maintenance、protocol/goal及steering消费者），本次不开跑。根node_modules存在，有限检查发现包链接指向main依赖、@flow contracts/client/protocols指向本树；不能随意删共享目标。历史专库零连接/absent有receipt，未新查PG。 |
| `runner-graceful-stop` | `3a1e908b257bced2abdad329d7a429414f34a2e8` / `codex/runner-graceful-stop` | 已main0cee7556；S01P03 a3e307fc v2 released，10:38:53.882Z；4628 tracked index entries | 保留 `plans/s01-graceful-stop`、`docs/evidence/s01p03`。复跑需按manifest恢复runtime/shutdown test及@flow/client/contracts、verifier等只读闭包，当前不用旧WT执行。root/runner/server node_modules存在；有限顶层链接指向main依赖，只属向外复用，不证明他树反向无依赖。resource-check记录own child close、loopback与temp cleanup，非当前OS扫描。 |

P03/P04原owner status_read本轮补充：未记其执行sparse，现core/S01准备不依赖这两树的源码或node_modules；未做全局引用扫描。CHATUI01本owner同样未执行sparse。以上三者是供Lead核操作历史与反向消费者的候选，**尚无本worker可自行确认并执行的收起决定**。所有被忽略文件/既有raw、Git固定提交及metadata链接保留，不把tracked clean等同无ignored产物。

## 第四项：X01仅条件候选

Mika转architecture_read的16:06:11 UTC核验：`plugin-management-plan` / `codex/plugin-management-plan`，HEAD `4de33e6688f0b002805388b35deb10723397cff7` clean，sparse/cone未设且list报告not sparse。本片delivered，完整X01仍in-progress，claim `6ddedc73-f019-4073-b421-d23d3dc8dedd v5 ACTIVE`，host两源停写，**不是released**。若Lead只接released候选，应将它KEEP。

只有Lead协调active owner后才可考虑保留闭包的可逆收起：`plans/x01-plugin-management`、`docs/evidence/x01`、`apps/runner/src/plugins/host.ts`及`host.test.ts`、`packages/plugin-runtime/package.json`及`src/package-store.ts`/`package-store.test.ts`、`fixtures/plugins/text-tool`三文件、根AGENTS/package.json/pnpm-workspace.yaml/pnpm-lock.yaml/tsconfig.json/vitest.config.ts和apps/runner/package.json。实际host→@flow/plugin-runtime→tar+fixture闭包须保持；center复跑前需先按center-manifest恢复8source+33readonly，当前不开跑。

该独立核验报告main/I02已消费Git blobs、13生产接线不指此WT，core已知配置无其绝对路径/alias；无已知活跃源码消费者，dashboard仍需canonical metadata。未据此声称全局无引用或已回收。

## 资源与方法限制

Lead最新报告Data available896,360,448B，实际窗口关闭，只小源码/static；本owner未重采df或推算净回收。方法沿本地find-skills/固定clean-code，核单一owner、已交付/完整任务、当前稀疏/历史未知、出向依赖/反向消费者区别；只写本父证据，不改四个候选树。Lead执行前fresh核HEAD/dirty/claim、自己的Git操作历史、需保留闭包与确切外部消费者，再单独记录资源变化。
