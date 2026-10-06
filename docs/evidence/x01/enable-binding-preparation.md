# X01 下一片：公开启用 → 冻结任务 → 真实 runner（待冻结的一页合同）

沿原 [X01](../../../plans/x01-plugin-management/plan.md)，不新增父计划。本段固定只读 main `65659028ec3aed7c4b5a68eb20a39a32026e5dc5`；中心材料 `a578bfd9`、host 双 gate `e6827d8a` 已接收主线，见 [main 接收记录](host-gates-main-acceptance.md)。当前 `invokeInstalledTool` 仍无 production caller。以下是推荐后继合同，不是已实现/已批准公有 API；旧 [输入观察](enable-binding-inputs.json) 只作历史。2026-10-06 16:28:29 UTC 核本树 HEAD `7f6d82228632ddc46723a3a8a3e3305733940ab7` clean、writer `6ddedc73…v5 ACTIVE` 原四 scope；本次只改两 metadata，host 两源继续停写。

## 推荐字段与调用边界

| 入口 / 权威 | 最小字段与确定语义 |
| --- | --- |
| authenticated runner 发布 host | 新 `POST /api/runner/plugin-host`：`{schemaVersion:1,storeId,hostApiMajor:1}`，storeId 沿已安装材料的有界 codec；runnerId 取凭据。只接 operator 配置的同机可信 store，tuple 对该 runner 不可变，冲突拒绝；这既非 native profile，也非 loaded/实时 availability。owner enable 选该 runner/store，执行前 runner 仍查自己 allowlisted digest 与真实材料。 |
| owner enable / disable | 沿现 `pluginCommandSchema.change` 加 `enable:{materialInstallOperationId,targetRunnerId,storeId}` / `disable`，保留外层 `expectedRevision,reason` 及原 Idempotency-Key/CAS/审计。enable 把新 revision 与原 029 installed receipt、X02 version/config/grants、host tuple 关联；不复制配置/grant 权威。configure/select-version/set-grants 后 revision 不等即拒**新** binding，需重新 enable；disable 仅停新 binding，已 accepted pin 不改。旧 `PluginInstallation.runtimeStatus:'unavailable'` 不改形；新增有界 runtime 读 DTO 单独返回 desiredEnabled、enabledRevision、bindingAllowed 和有限 reason。 |
| owner 创建工具任务 | 新 `POST /api/plugins/:id/tool-tasks`：`{expectedRevision,title,input,verification}` + 原 Idempotency-Key；input 同时满足 TaskSubmission 的 16000 字符和 host 16KiB，verification 复用现 nonempty/contains（默认 nonempty）。同注册锁下核当前一致 enabled tuple、`tool` grant、scope、enum-only 可用配置，再于**一个事务**调用 `acceptTask`、保存 binding，原 wake 一起提交。中心构造 ordinary `harness:'fixture'` carrier，不接受 caller 的 fixture/protocol/profile/engineering/resume；无需改通用 TaskSubmission。 |
| 冻结 assignment | `ClaimedTask.pluginToolBinding?`：`{schemaVersion:1,bindingId,invocationId,taskId,registrationId,registrationRevision,versionId,materialInstallOperationId,targetRunnerId,storeId,materialId,treeDigest,hostApiMajor:1,artifact,configuration,inputDigest}`。artifact 复用既有精确 package identity；三种 id 分开：registration UUID、029 install-operation UUID、receipt materialId 64hex。task/绑定/调用 id 由中心生成；attemptId/ownerVersion 来自原 claim，runner 组合为 host 的同一 FrozenToolInvocation；input 取 task.prompt 并验 digest，不重复传全文或路径。claim 的目标 host/资格 SQL 必须在 LIMIT 前，且创建 attempt 前复核；旧 runner 不能捡到此类任务。 |
| load / invoke 当前 grant | 新 runner gate 路由收原 ownership + `{bindingId,invocationId,phase:'load'|'invoke'}`；`ownedAttempt` 后查中心 binding、scope 与**当时** `tool` grant，不以旧 pin/第一次 ACK 替代。有限 receipt：同 tuple、phase、authorizedRevision、`replayed`；授权事务提交是本 phase 的权限检查时点。沿原 command 幂等保存一次 phase ACK；只首次明确 ACK 可执行对应动作，`replayed` 只供历史核对，绝不再执行。请求失败/超时/ACK 未知保留同 invocation，不换 key 或重新 import；第二 phase 必须单独检查当前权限。host 既有双 gate 后各自 ownership/abort 检查保持。 |
| 来源 → artifact 验证 | 执行模块调用真实 `invokeInstalledTool` 后沿原 outbox 顺序发 `artifact` → 新有限 `plugin-tool-result` → 原 `verification`；runtime 最后发 completed。新事件仅 `{bindingId,invocationId,artifactId,artifactVersion,materialId,treeDigest,hostApiMajor:1,packageArtifactId,packageSha256}`；task/attempt/owner 来自 event envelope。中心同 `reportEvents` fence/sequence/id/digest 事务核冻结来源和同 attempt 精确 artifact，生成自己的 detail/ref；runner 不伪造 DB ref。`evidence.ts` 仍重算 content hash 与 flow.text，不把受信 runner 来源报告当证明包内部正确。 |

**未知与锁顺序。** 新窄 `plugins/execution.ts` 只将 host `OUTCOME_UNKNOWN`、已发送 gate 的未知 ACK 包成可识别的 `PluginExecutionUnsettled`；auth/fence/EventStorage 错误原样保留。runtime 增加这一精确识别并走现 settlement-unknown 路径：不 completed、execute 返回 false、admission assignment 保留并停新 claim；不能只 `interrupt('lost')`，因为已 cancel 的 control 不改 reason。沿原 journal 重启仅 replay 已存事件/读历史，绝不重跑包；AttemptControl/AdmissionJournal 不增第二 FSM。pending import/invoke 取消不是包已停止证明。锁序 runner → task → attempt → registration；enable/task admission 若核 host 先 runner 再 registration，configure/disable 不反向锁 runner/task，不把 SHARE 升 UPDATE。旧 pin 的 material/config 保留，当前 grant 收紧在下一个 phase gate 生效。

## 最小切片、精确共享交接

| 主责 / 可独立交付 | literal 与唯一职责 |
| --- | --- |
| X01 领域片，授权后原 WT 实现 | `packages/contracts/src/plugin-runtime.ts`, `packages/contracts/src/plugin-runtime.test.ts`；`apps/server/src/plugin-runtime/commands.ts`（enable/任务命令）、`apps/server/src/plugin-runtime/store.ts`（host/runtime pointer/binding/gate 记录）、`apps/server/src/plugin-runtime/routes.ts`（公开入口/读回）、`apps/server/src/plugin-runtime/events.ts`（调用来源 record）、`apps/server/src/plugin-runtime/runtime.test.ts`（真实 public HTTP/PG 事务）。一份新 SQL 由 Lead 正式分配编号；复用唯一正式 SQL，不复制 029 或另拆空 migration helper。可先交公开 enable/冻结 binding/历史读回模块，明确尚无 runner 执行，不再交未被消费的纯 helper 堆叠。 |
| 中心共享 owner，由 Lead 明确领取 | `packages/contracts/src/plugins.ts`, `packages/contracts/src/plugins.test.ts`（加 enable/disable）；`apps/server/src/plugins/commands.ts`（单 revision 的窄复用接口）；`apps/server/src/runners.ts`（claim 条件/assignment）；`apps/server/src/events.ts`（调用领域 record）；`packages/contracts/src/runner.ts`（optional binding/事件 union）。`tasks.ts`/TaskSubmission/evidence.ts 首选只消费不修改。 |
| runner owner，由 Lead 明确领取 | 新 `apps/runner/src/plugins/execution.ts`, `apps/runner/src/plugins/execution.test.ts` 承担 host→事件适配；`apps/runner/src/runtime.ts` 只分派已授权 binding、识别 unsettled；`apps/runner/src/runner.test.ts` 验真实 public runRunner/journal。`apps/runner/src/main.ts`, `apps/runner/src/configuration.ts`, `apps/runner/src/configuration.test.ts` 只接 operator TrustedPackageStore 与 host 发布；`fixture.ts`、attempt-control、admission-journal 首选不改。旧 host 两源只消费，不恢复写权。 |
| F01 共享接线 | `packages/contracts/src/index.ts`、`packages/client/src/index.ts`、`apps/server/src/index.ts`，对应直接 client/生产 mount 检查新路径由 F01 冻结；CLI 在其 `apps/cli` scope 用同一客户端，Web/TUI 不另造 HTTP。16:28:29 账本 F01 `8470…v41` 持这些路径；CORE `c652…v3` 持 tasks/profile 源，不碰其范围。上述 runner/中心共享 literal 本次未见 active writer，不等于 X01 获授权。 |

剩余 Lead 决定压到**新 SQL 号、每个共享 literal 的唯一 writer、受控 main 输入**；上表就是推荐字段，不再等抽象 host/receipt 方案。资格发布/静态 installed/实际 loaded/有结果 callable 分开；registry 审计与 binding/gate 记录仅记事实，不新 scheduler、执行 FSM 或包隔离平台。Module/锁与 runtime settlement 接线有架构影响，实施交付后由 Lead 更新固定 main 架构图；本设计不改图。

**未来直接验收（本轮未运行）**：公开 register/fetch/install/configure/grant/enable → tool task → 指定真实 runRunner/import/invoke → 来源/flow.text → disable；错 host 不领取、同 key 精确重放/异内容冲突、disable 与新 binding 竞态/旧 pin、TLA 期间撤 grant 零 invoke、两个 gate ACK 未知零对应动作且 journal 保留、事件冲突回滚/精确 ref/中心重启读回。真实自有 fixture 不 mock loader；每层成功范围单独记录，不复用旧65/14/21作新证据。完整版本升级/rollback、active 或 unknown refs 阻 remove、三端、renderer/verifier/context、第三方隔离与 ESM 已加载版本上限仍在原 TODO。

方法：本地 `/Users/citrine/.agents/skills/find-skills/SKILL.md` 发现并沿用同根 `codebase-design/SKILL.md`、`clean-code/SKILL.md`（sickn33 固定 bdacd76）、`brainstorming/SKILL.md` 既有授权设计；本段核责任单一、有限字段、原错误传播与锁/资源边界。0 产品修改、工程测试、PG、SDK/provider、安装或 sparse 操作。

## 现成 npm 能力复用：X01-04 / X01-07 的新增明确验收

GO 于本轮要求：除自有零依赖 fixture 外，至少接入一个真实有用、来源与许可明确、版本固定的现成 npm 能力，经明确的 build-time bundle 或受控依赖方案接入 Flow Adapter。后继实施前固定所选上游包的来源、版本、许可、integrity/digest，以及 Adapter/构建输入与产物身份；记录实际能力由哪一包提供。升级需形成新包/构建身份，已有任务仍保留原冻结 pin，不能只改显示版本或复用旧通过记录。

该能力须沿同一公开 enable → 冻结 binding → 真实 runner 调用 → 有来源产物 → 独立验证链交付，并保留停用后拒绝新 binding、旧引用与未知结果语义。现 `package-store` 拒绝 `dependencies` 与 `node_modules` 是首片静态材料限制；零依赖自有 fixture 的通过不等于完整 npm 复用已验收。后继选择 bundle 或受控依赖时单独明确可复现构建、依赖与许可来源、有界材料及运行边界，不放开任意安装、安装脚本或新平台。

本轮仅归档需求，未选择或安装任何新包，没有形成新的依赖/产品 scope。质量方法沿已读本地 `find-skills`、`codebase-design`、固定 `clean-code`；检查职责、来源与执行事实的分界，保留所有原 TODO。本次零安装、工程测试、PG、SDK/provider，未改稀疏配置、缓存或旧证据。
