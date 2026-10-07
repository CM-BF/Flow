# X01 下一片：公开启用 → 冻结任务 → 真实 runner（待冻结的一页合同）

沿原 [X01](../../../plans/x01-plugin-management/plan.md)，不新增父计划。本段固定只读 main `65659028ec3aed7c4b5a68eb20a39a32026e5dc5`；中心材料 `a578bfd9`、host 双 gate `e6827d8a` 已接收主线，见 [main 接收记录](host-gates-main-acceptance.md)。当前 `invokeInstalledTool` 仍无 production caller。以下是推荐后继合同，不是已实现/已批准公有 API；旧 [输入观察](enable-binding-inputs.json) 只作历史。2026-10-06 16:28:29 UTC 核本树 HEAD `7f6d82228632ddc46723a3a8a3e3305733940ab7` clean、writer `6ddedc73…v5 ACTIVE` 原四 scope；本次只改两 metadata，host 两源继续停写。

## 2026-10-06 22:50 后继开工准备（当前推荐，替代上文旧输入/owner观察）

冻结源码 `60ca1942411634843fda14e158f138191b832d8b`；原 owner `3c5622ad` clean、claim `6ddedc73 v5 ACTIVE`。当前仅原树 metadata，host 两源停写。请求独立树 `plugin-enable-binding` / `codex/plugin-enable-binding`，仍属唯一 X01，同一路径 plan/status；详细 literal、供给与原子移交在 [source-only 请求](enable-binding-provision.md)，精确字节/hash 在 [清单](enable-binding-source-request.json)。旧段落中的“原 WT 实现”、共享空闲及 CORE/F01 owner 观察均只属16:30历史，不能作为当前写权。

首片收敛为领域合同、单 revision enable/disable、同事务冻结 binding 与只消费旧 host 的窄执行模块，生产路由暂不挂载。 当前唯一选择：enable/disable只走新领域 `POST /api/plugins/:id/runtime/commands` 与 `pluginRuntimeCommandSchema`（expectedRevision/reason/change），不向旧 `/api/plugins/:id/commands` 或旧 pluginCommandSchema 增加可执行分支。旧PluginOperation仅增加两种可读kind；本页下方16:30表的“沿旧change加enable/disable”是被此选择替代的历史推荐。新旧命令共用同一注册revision锁/append接口；领域幂等operation命名空间固定 `plugin.runtime.command:<id>`，复用现command的operation+key/body digest精确重放/异内容409，不引入全局跨operation key唯一性。008 的 operation kind CHECK 与公有 PluginOperation 类型必须前向兼容 enable/disable；现 `plugins/storage.ts` 提供一个内部 append-revision 接缝，由旧 changePlugin 与新领域命令共用，旧四 change/注册结果、错误、审计和旧五种读回保持。新领域命令用独立有界 schema，旧 registry command 路由不提前接新行为；旧 PluginInstallation 的 unavailable 投影保持，新的 runtime DTO 单独读事实。第一片不是生产可执行资格。

**生产挂载的必要门槛**：S01P07 的新 claim.v2 assignment 是 strict codec；历史持久 host tuple 不能证明当前/降级进程仍支持插件。因此必须由共享 owner 冻结明确的当前 claim 能力协商、center ACK 和 SQL-before-LIMIT 过滤，旧 decoder 不收到新 binding、绑定任务不走 fixture fallback。新领域 route 仅在这些共享条件及 reconciliation 防降级 guard 已接收后由 Lead factory 启用；模块验证不能让未就绪公共中心创建可被旧 runner 领取的任务。本片只消费固定main现有类型，不复制未合入的 S01 codec。

**窄执行 Interface**：`plugins/execution.ts` 接中心 FrozenPluginToolBinding、原 attempt/ownerVersion、可信 store、load/invoke 当前授权 port、ownership、abort，复用 `invokeInstalledTool` 和 `verifyText`；返回有限 artifact/verification/provenance 给原 runtime/outbox caller，不另发HTTP、分配sequence或伪造中心ref。原 host 参数 configuration 为字符串；中心声明允许的 boolean/integer/enum 在此唯一适配为 `true/false`、规范十进制、原enum字符串，binding仍保原有限配置和digest，不能假装宿主已原生支持任意配置。当前推荐首实际包只有无配置compare，通用类型适配必须有直接行为证据。只有既定 OUTCOME_UNKNOWN / 已发送授权 ACK 未知转成 caller 可识别 unsettled，fence/emit异常保身份；共享 runtime 接线前只称独立leaf，不称恢复已完成。

Root已选择 `semver@7.8.5` / ISC 的确定性 compare 能力作为 X01-04/07 真实npm验收方向。拟后续显式build-time单index.mjs bundle，固定源、构建参数、两manifest/license与产物digest；编译常量消除 NODE_DEBUG 读取，不改宿主环境。初始供给不复制任何 node_modules 或上游包源码，不安装/build；锁SRI只声明，不能当tarball已验证。外部来源由独立固定记录交接，本轮不再选包或运行。

2026-10-06 22:59:39 UTC纠正：68db供给包漏两个有限动态迁移数组中的012/013/017/019，source-complete撤回；新版清单在相同main60ca显式绑定四SQL。新树browser检查先修已领脚本输出到自有X01排他namespace，旧X03不可写。详[供给纠正](enable-binding-provision.md)。本段不变更产品合同或14候选。

## 推荐字段与调用边界

| 入口 / 权威 | 最小字段与确定语义 |
| --- | --- |
| authenticated runner 发布 host | 新 `POST /api/runner/plugin-host`：`{schemaVersion:1,storeId,hostApiMajor:1}`，storeId 沿已安装材料的有界 codec；runnerId 取凭据。只接 operator 配置的同机可信 store，tuple 对该 runner 不可变，冲突拒绝；这既非 native profile，也非 loaded/实时 availability。owner enable 选该 runner/store，执行前 runner 仍查自己 allowlisted digest 与真实材料。 |
| owner enable / disable | 沿现 `pluginCommandSchema.change` 加 `enable:{materialInstallOperationId,targetRunnerId,storeId}` / `disable`，保留外层 `expectedRevision,reason` 及原 Idempotency-Key/CAS/审计。enable 把新 revision 与原 029 installed receipt、X02 version/config/grants、host tuple 关联；不复制配置/grant 权威。configure/select-version/set-grants 后 revision 不等即拒**新** binding，需重新 enable；disable 仅停新 binding，已 accepted pin 不改。旧 `PluginInstallation.runtimeStatus:'unavailable'` 不改形；新增有界 runtime 读 DTO 单独返回 desiredEnabled、enabledRevision、bindingAllowed 和有限 reason。 |
| owner 创建工具任务 | 新 `POST /api/plugins/:id/tool-tasks`：`{expectedRevision,title,input,verification}` + 原 Idempotency-Key；input 同时满足 TaskSubmission 的 16000 字符和 host 16KiB，verification 复用现 nonempty/contains（默认 nonempty）。同注册锁下核当前一致 enabled tuple、`tool` grant、scope、enum-only 可用配置，再于**一个事务**调用 `acceptTask`、保存 binding，原 wake 一起提交。中心构造 ordinary `harness:'fixture'` carrier，不接受 caller 的 fixture/protocol/profile/engineering/resume；无需改通用 TaskSubmission。 |
| 冻结 assignment | `ClaimedTask.pluginToolBinding?`：`{schemaVersion:1,bindingId,invocationId,taskId,registrationId,registrationRevision,versionId,materialInstallOperationId,targetRunnerId,storeId,materialId,treeDigest,hostApiMajor:1,artifact,configuration,inputDigest}`。artifact 复用既有精确 package identity；三种 id 分开：registration UUID、029 install-operation UUID、receipt materialId 64hex。task/绑定/调用 id 由中心生成；attemptId/ownerVersion 来自原 claim，runner 组合为 host 的同一 FrozenToolInvocation；input 取 task.prompt 并验 digest，不重复传全文或路径。claim 的目标 host/资格 SQL 必须在 LIMIT 前，且创建 attempt 前复核；旧 runner 不能捡到此类任务。 |
| load / invoke 当前 grant | 新 runner gate 路由收原 ownership + `{bindingId,invocationId,phase:'load'|'invoke'}`；`ownedAttempt` 后查中心 binding、scope 与**当时** `tool` grant，不以旧 pin/第一次 ACK 替代。有限 receipt：同 tuple、phase、authorizedRevision、`replayed`；授权事务提交是本 phase 的权限检查时点。沿原 command 幂等保存一次 phase ACK；只首次明确 ACK 可执行对应动作，`replayed` 只供历史核对，绝不再执行。请求失败/超时/ACK 未知保留同 invocation，不换 key 或重新 import；第二 phase 必须单独检查当前权限。host 既有双 gate 后各自 ownership/abort 检查保持。 |
| 来源 → artifact 验证 | 执行模块调用真实 `invokeInstalledTool` 后沿原 outbox 顺序发 `artifact` → 新有限 `plugin-tool-result` → 原 `verification`；runtime 最后发 completed。新事件仅 `{bindingId,invocationId,artifactId,artifactVersion,materialId,treeDigest,hostApiMajor:1,packageArtifactId,packageSha256}`；task/attempt/owner 来自 event envelope。中心同 `reportEvents` fence/sequence/id/digest 事务核冻结来源和同 attempt 精确 artifact，生成自己的 detail/ref；runner 不伪造 DB ref。`evidence.ts` 仍重算 content hash 与 flow.text，不把受信 runner 来源报告当证明包内部正确。 |

**未知与锁顺序。** 新窄 `plugins/execution.ts` 只将 host `OUTCOME_UNKNOWN`、已发送 gate 的未知 ACK 包成可识别的 `PluginExecutionUnsettled`；auth/fence/EventStorage 错误原样保留。runtime 增加这一精确识别并走现 settlement-unknown 路径：不 completed、execute 返回 false、admission assignment 保留并停新 claim；不能只 `interrupt('lost')`，因为已 cancel 的 control 不改 reason。沿原 journal 重启仅 replay 已存事件/读历史，绝不重跑包；AttemptControl/AdmissionJournal 不增第二 FSM。pending import/invoke 取消不是包已停止证明。锁序 runner → task → attempt → registration；enable/task admission 若核 host 先 runner 再 registration，configure/disable 不反向锁 runner/task，不把 SHARE 升 UPDATE。旧 pin 的 material/config 保留，当前 grant 收紧在下一个 phase gate 生效。现 `reconciliation.retryReconciled` 只复制 TaskSubmission 与 K02/goal 输入，不能复制独立插件 binding；首片对已有 plugin binding 的通用 retry 明确 `409 plugin_recovery_required`，保留 read/observation/显式 stop 审计，防止降成普通 fixture 后伪成功。完整插件恢复仍开放，不以新 invocation 自动重跑。

## 最小切片、精确共享交接

| 主责 / 可独立交付 | literal 与唯一职责 |
| --- | --- |
| X01 领域片，授权后原 WT 实现 | `packages/contracts/src/plugin-runtime.ts`, `packages/contracts/src/plugin-runtime.test.ts`；`apps/server/src/plugin-runtime/commands.ts`（enable/任务命令）、`apps/server/src/plugin-runtime/store.ts`（host/runtime pointer/binding/gate 记录）、`apps/server/src/plugin-runtime/routes.ts`（公开入口/读回）、`apps/server/src/plugin-runtime/events.ts`（调用来源 record）、`apps/server/src/plugin-runtime/runtime.test.ts`（真实 public HTTP/PG 事务）。一份新 SQL 由 Lead 正式分配编号；复用唯一正式 SQL，不复制 029 或另拆空 migration helper。可先交公开 enable/冻结 binding/历史读回模块，明确尚无 runner 执行，不再交未被消费的纯 helper 堆叠。 |
| 中心共享 owner，由 Lead 明确领取 | `packages/contracts/src/plugins.ts`, `apps/server/src/plugins/plugins.test.ts`（旧命令与新增operation直接兼容）；`apps/server/src/plugins/commands.ts`（单 revision 的窄复用接口）；`apps/server/src/runners.ts`（claim 条件/assignment）；`apps/server/src/events.ts`（调用领域 record）；`packages/contracts/src/runner.ts`（optional binding/事件 union）；`apps/server/src/reconciliation.ts`（仅通用 retry 的 plugin binding guard，当前 CORE v3 持有）。`tasks.ts`/TaskSubmission/evidence.ts 首选只消费不修改。 |
| runner owner，由 Lead 明确领取 | 新 `apps/runner/src/plugins/execution.ts`, `apps/runner/src/plugins/execution.test.ts` 承担 host→事件适配；`apps/runner/src/runtime.ts` 只分派已授权 binding、识别 unsettled；`apps/runner/src/runner.test.ts` 验真实 public runRunner/journal。`apps/runner/src/main.ts`, `apps/runner/src/configuration.ts`, `apps/runner/src/configuration.test.ts` 只接 operator TrustedPackageStore 与 host 发布；`fixture.ts`、attempt-control、admission-journal 首选不改。旧 host 两源只消费，不恢复写权。 |
| F01 共享接线 | `packages/contracts/src/index.ts`、`packages/client/src/index.ts`、`apps/server/src/index.ts`，对应直接 client/生产 mount 检查新路径由 F01 冻结；CLI 在其 `apps/cli` scope 用同一客户端，Web/TUI 不另造 HTTP。16:28:29 账本 F01 `8470…v41` 持这些路径；CORE `c652…v3` 持 tasks/profile 源，不碰其范围。上述 runner/中心共享 literal 本次未见 active writer，不等于 X01 获授权。 |

剩余 Lead 决定压到**新 SQL 号、每个共享 literal 的唯一 writer、受控 main 输入**；上表就是推荐字段，不再等抽象 host/receipt 方案。资格发布/静态 installed/实际 loaded/有结果 callable 分开；registry 审计与 binding/gate 记录仅记事实，不新 scheduler、执行 FSM 或包隔离平台。Module/锁与 runtime settlement 接线有架构影响，实施交付后由 Lead 更新固定 main 架构图；本设计不改图。

**未来直接验收（本轮未运行）**：公开 register/fetch/install/configure/grant/enable → tool task → 指定真实 runRunner/import/invoke → 来源/flow.text → disable；错 host 不领取、同 key 精确重放/异内容冲突、disable 与新 binding 竞态/旧 pin、TLA 期间撤 grant 零 invoke、两个 gate ACK 未知零对应动作且 journal 保留、事件冲突回滚/精确 ref/中心重启读回、通用 retry 不丢 binding 降为 fixture。真实自有 fixture 不 mock loader；每层成功范围单独记录，不复用旧65/14/21作新证据。完整版本升级/rollback、active 或 unknown refs 阻 remove、三端、renderer/verifier/context、第三方隔离与 ESM 已加载版本上限仍在原 TODO。

方法：本地 `/Users/citrine/.agents/skills/find-skills/SKILL.md` 发现并沿用同根 `codebase-design/SKILL.md`、`clean-code/SKILL.md`（sickn33 固定 bdacd76）、`brainstorming/SKILL.md` 既有授权设计；本段核责任单一、有限字段、原错误传播与锁/资源边界。0 产品修改、工程测试、PG、SDK/provider、安装或 sparse 操作。

## 现成 npm 能力复用：X01-04 / X01-07 的新增明确验收

GO 于本轮要求：除自有零依赖 fixture 外，至少接入一个真实有用、来源与许可明确、版本固定的现成 npm 能力，经明确的 build-time bundle 或受控依赖方案接入 Flow Adapter。后继实施前固定所选上游包的来源、版本、许可、integrity/digest，以及 Adapter/构建输入与产物身份；记录实际能力由哪一包提供。升级需形成新包/构建身份，已有任务仍保留原冻结 pin，不能只改显示版本或复用旧通过记录。

该能力须沿同一公开 enable → 冻结 binding → 真实 runner 调用 → 有来源产物 → 独立验证链交付，并保留停用后拒绝新 binding、旧引用与未知结果语义。现 `package-store` 拒绝 `dependencies` 与 `node_modules` 是首片静态材料限制；零依赖自有 fixture 的通过不等于完整 npm 复用已验收。后继选择 bundle 或受控依赖时单独明确可复现构建、依赖与许可来源、有界材料及运行边界，不放开任意安装、安装脚本或新平台。

本轮仅归档需求，未选择或安装任何新包，没有形成新的依赖/产品 scope。质量方法沿已读本地 `find-skills`、`codebase-design`、固定 `clean-code`；检查职责、来源与执行事实的分界，保留所有原 TODO。本次零安装、工程测试、PG、SDK/provider，未改稀疏配置、缓存或旧证据。
