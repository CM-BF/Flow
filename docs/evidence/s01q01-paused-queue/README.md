# S01Q01 源码准备证据

固定产品基线 `b79121e1944f10f82a416d98d776c0f55bf9c943`；[源输入](source-inputs.json)含 252 fixed Git paths、mode、bytes/hash，合计 1,237,032B；未复制 node_modules、其他任务 raw 或私人数据。[原子领取](take-receipt.json)。源 operator 先 no-checkout，再本 worktree sparse 设置与 read-tree 初始化；空 index 的暂时 D 状态已在首次项目写入前恢复，最终初始工作树 clean，没有删除共享文件。

## 后继真实验证（NOT_OPEN）

先选两新增用例；通过后按影响选现有错误回滚/fair scan、limit、pause/completion/promote 与显式 resume/ACK 用例，不跑 128 基准或全库。固定 Node24/pnpm9.15.4/Vitest4.0.18；本树源/动态迁移闭包与真实已有依赖入口需紧前绑定，内部 @flow 必须指本树。本段无任何工程 child/types/test/PG/HTTP。

当前 queue.test.ts fixture 本身不能冒充已准备好的安全执行入口：它仍把回执写入旧 docs/evidence/chat04，CREATE ACK 用 created bool、关闭缺统一绝对 deadline/marked identity。未来在当前合法测试叶或自有 evidence 内适配已审 marked DB owner/OPS14 方法，不能写旧 scope、不按随机库名猜拥有、不 force DROP、unknown KEEP；先固定入口独审再窗口。

配置连接上限静态合计 **24**：admin1 + fixture SQL pool10 + fixture boss2 + createServer business8 + center boss3；不是实测连接峰值。初始新增两用例只用一个 center，无第二 center；autoQueueScan=false 仍有 lease sweep/pg-boss 背景。若选择原双 center 用例还需另计 pool2+business8+boss3，不能沿用 24。新测试数据最多 23 conversations/24 queue items/3 promoted tasks，短文本合计小于 2KiB（非数据库物理字节）。原公平性消费者额外数据单独计。

未来候选一次 ≤90s（50s work/30s cleanup/10s receipt），逻辑 DB≤64MiB末 sample不作硬峰值，local/raw≤2MiB，动态127.0.0.1端口/唯一带 marker 数据库。每次 SQL/HTTP 在剩余 deadline 内，不把 HTTP abort当SQL已停止；owner app/boss/pools 确认关闭、身份再核、0connections后普通DROP、lstat/DBabsence回执。未知创建/启动/关闭保留确切 identity/原失败，不继续下一场景。资源与窗口尚未申请，此处只是最小候选。

## 方法与质量

本地 find-skills → brainstorming/codebase-design/clean-code；需求设计已由 GO/Mika 授权，未重复审批/安装。clean-code 固定 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。应用：不扩调度器职责，SQL 候选选择与锁内权威复核分别保留；测试从真实 API/PG 状态断言，不镜像 SQL。实际技能内容 hash 见 skills.json。源码完成后复核命名/单职责/错误路径和已有断言保留；实际 red/green NOT_RUN。

## 固定源交付

2026-10-07T16:31:06.487336+00:00：实现 target `42c6c8cf81d3d648fc3477109e66db6c843aefe3`，两源SHA见source-checkpoint.json。clean-code收尾：一个candidate predicate，无新抽象/重复状态；锁内暂停复核和异常隔离未改；原测试全文从新增两例前后拼回与base逐字相等。当前没有执行证据，不将静态行为推导写成red/green。源码准备 STOP，claim保留待独审/下一有界入口准备。

## 2026-10-07 fixture preparation successor (PG NOT_OPEN)

The one-line `promotion.ts` predicate remains byte-identical to `42c6c8c`. The test now delegates resource ownership to this task's `pg-fixture.ts`, adapting the marked DB lifecycle from the fixed `b79121e` X01-removal reference. No new product fixture path or supervisor is introduced. Every original business assertion and both new cases remain; the normalized test-body proof is in `fixture-preparation.json`.

- Dedicated generated DB `flow_s01q01_<32hex>`, explicit CREATE intent/ACK then OID/owner/marker and fsynced receipt. Unknown CREATE or record failure never licenses DROP. It never reuses CHAT04 evidence paths.
- Factory import is performed inside tracked work before DB creation. Factory starts/listen promises are tracked; closing prohibits new starts, aborts listening, joins pending operations, and final close verifies `server.listening === false`. An unresolved operation/close/identity is KEEP. Timeouts are observations, not cancellation proofs.
- Planned common 120s frame: 70s work / 40s cleanup / 10s receipt, measured from external operator's actual start; only a **proposal**, no live permit. Auxiliary/admin SQL have 1500ms statement and 1800ms client limits; production business/scheduler defaults stay unchanged. The fixture's test-only boss also keeps its package defaults. Each HTTP request gets remaining-work cancellation and count cap256. Response-body storage/total candidate bytes need final actual caller binding; this source stage does not claim an enforced DB/local peak cap.
- Configuration totals are 24 connections (1 admin +10 fixture +2 fixture boss +8 factory +3 factory boss). The existing two-center case adds2 helper pool +8 business +3 boss =13, peak configured37. No package worker is enabled. Timers/background jobs are still present with `automaticQueueScan:false`.
- Finish closes all known servers, fixture boss and pools, verifies matching DB identity plus up to20 bounded activity observations, checks identity again, performs ordinary DROP only with zero connections, then confirms absence and closes admin. Failed or unknown facts retain DB/evidence. No FORCE, external signals or old KEEP access.
- Only the two new mixed-paused/ready and pause-race cases are initial future candidates. Running all historical cases needs an explicit separate selection/time/request budget; preserving assertions is not execution evidence.

The fixed source closure contains252 files/1,237,032B including fixed migration SQL and package entries. A private ignored `.source` receives that fixed Git content plus explicit current test/promotion/helper overlays. Seventeen installed dependency aliases and three `@flow` aliases point respectively to fixed existing package directories and this supply; no moving-main internal package resolution, installation or full node_modules copy. `types.tsconfig.json` inherits ES2023 and `noEmit`; command candidate:

```text
/opt/homebrew/opt/node@24/bin/node docs/evidence/s01q01-paused-queue/node_modules/typescript/bin/tsc --noEmit --project docs/evidence/s01q01-paused-queue/types.tsconfig.json
```

This command was **not run**. Mika drained engineering before the first launch at17:17:38Z; no OPS14 child/PID/TMP/PG/HTTP was created. Caller+focused type and bounded real lifecycle evidence remain required. Subsequent actual execution must bind the fixed source/helper, a new marked record root, explicit `FLOW_S01Q01_PG_OPEN=reviewed`, actual start/head/window and fresh manager resource floor. Merely setting environment variables is not authorization. OPS14 still owns process supervision; fixture owns only its DB/servers/pools. Synthetic or static source review cannot approve a PG window.

## 后台失败传播修复（2026-10-07T19:27:05.171494+00:00）

唯一新局部入口：[failure-local/summary.json](failure-local/summary.json)，运行只一份[iterations](failure-local/iterations.json)。固定source `01dfc89e43fb7793bc3d022b05ea34c129755073`。后台首错现在拒绝后续work；正常清理后仍抛原错误，回执可同时为资源CLOSED与验证FAILED；清理unknown保原cause，持久回执失败保双错。

7/7纯fake资源故障用例及focused fixture types通过，原red1失败和首green4失败/3通过原件保留；无真实PG/HTTP/数据库创建。外部FS/Pool/Boss被内存Adapter替换，真实fixture admission/finish路径不替换。真实paused扫描、整个历史suite/types与实际120秒生命周期仍NOT_RUN。上方原90秒提案及历史旧fixture说明仅历史，当前不据此OPEN；正式候选需完整运行绑定、预算与新窗口。4child19:22:32.454554Z全部归还，停止launch。
