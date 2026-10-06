# X01 下一片：中心静态安装与公开读回（设计待审）

**请求 Lead 分配唯一 migration 编号与 owner，并明确下表新文件/共享挂载的 writer；本页不申请或占用猜测的029。028实际已被 WPF-CONNECTION01 领取。** 本页基于[固定15源码输入](center-installation-seam-inputs.json) `main@a3e670b9`、已审[leaf集成输入](leaf-integration-ready.md)，沿原[纵向方案](vertical-interface.md)/[完整scope请求](scope-request.md)，不新父计划。进度仅[status](../../../plans/x01-plugin-management/status.md)。旧scope表是历史观察，实际领取必须fresh账本。

## 最小可用结果与现有事实

先交 **public register/fetch → install → 可查询的真实材料receipt与审计**。同一自有npm fixture经既有真实loopback registry/X05下载，中心调用唯一`@flow/plugin-runtime`静态prepare/read；不import、不自动grant/enable。此片不必等runner host资格，却不冒称完整vertical。

已有`admitFetch`/`readFetch`固定registration/version/admittedRevision/storeId及成功attempt.artifact；X02 `command()`提供幂等key，`loadInstallation(...,true)`/immutable `plugin_revisions`提供revision与锁。新安装领域复用这些身份，**不能把X05 succeeded改名installed**，也不能改旧`PluginInstallation.runtimeStatus='unavailable'`的旧DTO语义。新versioned安装reader独立呈现material outcome；旧Web/CLI读取继续兼容。

## 提议公开合同与执行边界

- `POST /api/plugins/:id/versions/:versionId/install`（owner）：`{expectedRevision,fetchOperationId,fetchAttemptId,reason}` + 既有idempotency-key，最多4KiB。拒客户端paths/store根/artifact JSON/installed声明；中心锁registration，验证scope、version归属、revision CAS及所指**确切成功attempt**，从DB冻结artifact（全identity/SRI/SHA/bytes）与operator配置store。不是按请求当时latest fetch自行跳版本。相同key/canonical payload重放同operation；异payload409，不能再运行静态写入。
- `GET /api/plugin-installs/:id` + 按registration分页history（默认20/max40、response≤64KiB）：有界DTO含registrationId、versionId、admittedRevision、fetchOperation/attempt/artifactId、storeId、materialId、treeDigest/hostApiMajor、state、finite error、DB timestamps、审计cursor。**materialId对应leaf receipt.installationId的64hex，不与既有registration UUID混名**。内部存完整有限receipt，公开不返本地entrypoint URL、root/path、retained原路径或包全文。installed是已核材料事实；enabled/loaded/callable均没有此片证据。
- 一次请求先transaction提交operation，再在事务外执行有界`prepareInstalledPackage`，最后transaction记录结果；原`command`回执只存稳定operationId，重放时另读当前状态。没有常驻新worker/队列。session级、按store的PG advisory lock复用X05模式，限定同store一次静态prepare；所有DB阶段使用持锁client，连接lost立即abort且不得用新连接宣称旧执行已结束。请求/关闭abort合作收束；不把时间限制当FS强停。DB事务绝不持有整个解压/I/O过程。
- 明确首次启动状态`accepted → preparing → installed|failed|unknown`；`preparing`仅表示已发起未确定，读回不得自动当活进程或失败。进程崩溃/丢ACK/取消且写入结局不明保留unknown；仅精确operation/receipt的 **reconcile读** 可以转installed，不重下载、不扫描、不重跑包代码。公开`POST .../:id/commands`仅`reconcile`；只有`accepted`且从未开始可在独占lock下首次prepare，`preparing/unknown`不能盲目再次prepare。并发busy返回有限可重试结果、不起后台promise；同store串行策略和请求deadline由实现前合同固定。旧未知operation在取得同store独占锁后仍必须精确核盘，锁本身不证明安装成功。
- artifact路径来自受信X05配置root +已验证UUID；先`readPackageArtifact`复核真实receipt，投影给leaf并由leaf再校验压缩字节。operator trusted digest allowlist、canonical private安装root/storeId必需；不从HTTP授予。leaf返回UNKNOWN的路径只作宿主有限恢复输入，不进公有audit。未来清理/移除需任务refs合同，本片不做删除。

## 唯一DDL与精确路径请求

唯一DDL建议先仅两类数据：`plugin_material_installs`（operation、固定registration/version/revision/fetch-attempt/store/artifact、state/receipt/有限error；组合FK保证归属，JSON≤32KiB、state↔receipt一致性、一个不可变输入摘要）与append-only `plugin_material_install_audit`（owner/center actor、DB时钟、finite transition、cursor）。重放复用flow命令表，不另造key权威。最终表名/约束随正式migration一次固定；不得fixture重复CREATE。

| 责任 | 精确候选literal（尚未领取） |
| --- | --- |
| X01 owner，同权威WT/branch | `packages/contracts/src/plugin-installations.ts`, `packages/contracts/src/plugin-installations.test.ts`, `apps/server/src/plugin-installations/store.ts`, `apps/server/src/plugin-installations/commands.ts`, `apps/server/src/plugin-installations/routes.ts`, `apps/server/src/plugin-installations/migration.ts`, `apps/server/src/plugin-installations/installations.test.ts` |
| Lead分配唯一migration给X01或指定owner | `packages/storage/migrations/<正式分配>-plugin-material-installs.sql`（说明占位，不能作为claim literal） |
| F01 v34已有共享范围，接线待其协调 | `packages/contracts/src/index.ts`, `packages/client/src/index.ts`, `apps/cli/src/index.ts`, `apps/server/src/index.ts`；若新增operator配置需要main/config路径，另明确精确scope，不借mount扩大 |

后继public enable/disable仍与X02 registration同锁/revision受理，不另造一套config/grant revision。disable拒**新**binding，旧已受理任务保持pin；grant收紧在后续动作受理线性化，不能承诺撤回已开始动作。runnerId/store/hostApi资格、task binding/event provenance与active/unknown refs继续由Lead冻结，再接真实runner纵向，不提前改runtime/union。现leaf配置只接string record，X02公有配置允许boolean/int/enum；首text-tool仅用声明的string enum，不能隐式String()降格其他类型，通用typed适配由后继合同明确。

## 受影响验证与完整验收

获正式DDL/scope后：唯一迁移建随机专库、动态loopback端口、真实npm fetch→prepare（不mock loader/材料）→GET；同key重放/异key冲突、cross-registration/version/attempt拒绝、requested revision CAS、无trust提前拒绝、文件损坏、DB回滚、首次受理后崩溃/准备后ACK丢失→restart精确read、busy/取消与cleanupunknown、owner/runner鉴权。先模块public seam，再F01真实createServer/client组合；不复跑全库、不调用SDK/provider。当前0源码修改/0PG/0tests。

完整X01仍包含启用/grant/真实runner工具产物verify/停用新binding、v2新任务与v1旧pin、rollback未来绑定、active/unknown refs阻remove、restart审计、Web/TUI/CLI、renderer/verifier/context及第三方隔离。当前slice没有缩减这些TODO；材料leaf已独审可先集成，设计依赖不等于整个大task停止。
