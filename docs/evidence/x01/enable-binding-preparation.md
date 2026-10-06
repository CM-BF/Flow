# X01 下一片：启用与真实工具任务绑定（设计请求）

沿原 [X01](../../../plans/x01-plugin-management/plan.md)，不新增父计划。早期 [16 项源码输入/写权观察](enable-binding-inputs.json) 固定 main `5dbabadc7dda02da558f48505677eddbc9c83fb5`，保留为历史设计输入，不冒充后继实现基线。中心材料 `a578bfd9` 和 host 双 gate `e6827d8a` 已接收主线，见 [main 接收记录](host-gates-main-acceptance.md)。2026-10-06 16:09 UTC 只读核 main `e807730328a8f220721efcc3e346c03945991965` clean：`invokeInstalledTool` 在 runner 源码中仍只有定义和测试调用，没有真实 `runRunner` production caller。本页记录下一纵向片及验收输入，未领取新产品 scope、未运行检查。

## 最小行为与复用

1. **同一 registration revision**：沿 `plugins/commands.ts:46–83` 的注册行锁、CAS、不可变 version/config/grants 和 command 审计追加 enable/disable；提取确有两个消费者的 revision append 接口，不复制更新算法。新 runtime 行只保存 desired enabled、精确已 installed operation、目标 host，不造第二套配置/grant 版本。首片建议 enable 固定资格 revision；之后 configure/select-version/set-grants 使它与 current revision 不同，新 binding 必须拒绝并要求对新 revision 显式 enable，不能绕旧指针绑定材料/配置。资格是否 stale 由比较投影，不另建状态机；enable 重新验证当前 version/config/material/grant/host。旧 accepted pin 不重写。旧 reader 的 `runtimeStatus: unavailable` 保持兼容，新 DTO 明示 desired enabled 与当前可绑定条件。
2. **先固定任务再执行**：候选公开 `POST /api/plugins/:id/tool-tasks` 使用 `tasks.ts:49–58` 的 `acceptTask(tx,boss,...)`，在同一事务插入 immutable binding 与原 wake。首片是显式 ordinary fixture carrier，排除 native/engineering/resume；无需先扩通用 TaskSubmission。binding 固定 revision/config、材料/host/store/hostApi、输入 digest，中心生成 task/binding/invocation 身份。disable 与新 binding 在同注册锁序列化；disable 后拒新 binding，已受理旧 pin 继续，不用 enabled=false 改写旧 claim。
3. **host 资格单独固定**：`runners.ts:48–78` 目前只筛 harness/profile/用途，fixture 不证明能执行插件。建议 owner 确认目标 runner/store/hostApi，authenticated runner 只发布其 operator 配置的同机 store 身份；中心与 runner 各自核 allowlisted self-owned digest。宿主资格发布的最小字段及其 owner/runner 双方权威须 Lead 冻结，不能复用 native profile 冒名，也不把发布记录当实时可用性证明。claim 只核冻结 binding 与该 host 的资格/凭据，不能强断已接受旧 pin。
4. **实际调用沿现有 lease/event/journal**：新窄 runner execution 模块调用已审 `invokeInstalledTool`。host 已实现同一冻结 binding/invocation 的 `load` 与 `invoke` 双 gate；真实异步 import 后、invoke 前再次调用授权接口的本地行为已交付。后继须把这两个接口接到中心当前 tool grant，ownership、旧 pin 或本地测试不能替代实时权限事实。两次 gate 都在原 ownedAttempt fence 下读取当时 grant；已保存的同身份受理记录不能绕过第二次实时校验。第二 gate 的 ACK 未知则零 invoke，首次授权 ACK 未知/重启恢复不得重新 import/execute；不换 invocationId 重试。门禁记录是原调用身份/审计，不是第二执行 FSM。host 的 `OUTCOME_UNKNOWN` 若直接进入当前 runtime 的普通 catch 会发 failed/completed，须明确插件分支进入原 admission 保留路径；不伪造 NativeExecutionError。S01 P06 AttemptWakeup、wait/drain/fatal/unknown 行为保留。
5. **来源与验证分开**：有限 plugin receipt/provenance 通过原 reportEvents 连续 sequence/id/digest 与 ownedAttempt 事务绑定（`events.ts:79–107`），exact artifact/version 仍由 `evidence.ts:13–35` 保存并独立重算 flow.text 验证。中心只核受信 runner 报告及归属，不声称证明包内部；普通 detail 文本不是权威来源。loaded 是真实 import 观察，enabled/installed 不代替 callable。包输入/输出各沿 leaf 16KiB，首 fixture 只接受原 enum/string 配置，不能把 X02 boolean/integer 静默字符串化。

锁顺序维持 runner → task → attempt（`runners.ts:20–40`）；新调用随后锁 registration。若任务受理需锁 host runner，应先 runner 再 registration；configure/disable 不再反向锁 runner/task。沿旧 FOR SHARE fence，不做 SHARE→UPDATE 升级。执行未知明确复用现 retained admission/journal 和停止新 claim 路径，不另建 plugin 执行 FSM。取消只停止观察；lease 到期、disable、删除文件或 ESM cache 操作都不是包结束/卸载证明。

**交 Lead 决策的最小字段（候选，不是新公有合同）**：
- authenticated runner 的 host 发布仅 `{storeId: bounded64, hostApiMajor: 1, harness: 'fixture'}`；runnerId 取凭据，中心时间取 DB。owner enable 明确选择该 runner/store；center 已安装材料来自原 operator digest allowlist，runner 执行前仍核自己的 allowlist/实际 receipt。该 tuple 对本次 runner 资格固定，冲突配置不静默覆盖；需要换 store 先协调旧 refs/新资格，不新增通用能力平台。发布记录不是 loaded 或实时 availability。
- enable 请求 `{expectedRevision, materialInstallOperationId, targetRunnerId, storeId, reason}`；disable `{expectedRevision, reason}`。registrationId 来自路由，已安装版本/material/hostApi 从中心029与X02取值；新 binding 只接受当前一致资格，不能接 caller 自报 expected/current 材料证明。
- task binding 下发 `{schemaVersion:1, bindingId, invocationId, taskId, registrationId, registrationRevision, versionId, materialInstallOperationId, targetRunnerId, storeId, materialId, treeDigest, hostApiMajor:1, artifact:{artifactId,name,version,bytes,sha256,integrity}, configuration, inputDigest}`；无路径/entrypoint URL/token，attemptId/ownerVersion 仍来自原 claim envelope，configuration 固定原 typed 值并拒本首宿主不支持类型。
- grant gate 请求仅原 ownership + `{bindingId, invocationId, phase:'load'|'invoke'}`；中心反查 task/material/host/input，读取当前 tool grant，返回同身份的有限 phase receipt。第二 gate 必须独立核当前权限，即使同身份第一 gate 已成功；ACK未知不执行对应动作，恢复只读历史，不根据已受理自动重执行。执行/来源回报仍走原 event 序列，确切事件字段在共享 union owner 处冻结。

## 精确路径候选与依赖（不是领取）

| 下一片责任 | 精确 literal 候选 / 共享输入 |
| --- | --- |
| X01 领域 owner architecture_read，仍原 WT/branch | `packages/contracts/src/plugin-runtime.ts`, `packages/contracts/src/plugin-runtime.test.ts`, `apps/server/src/plugin-runtime/commands.ts`, `apps/server/src/plugin-runtime/store.ts`, `apps/server/src/plugin-runtime/bindings.ts`, `apps/server/src/plugin-runtime/routes.ts`, `apps/server/src/plugin-runtime/runtime.test.ts`；一份正式新 SQL 编号/owner 待 Lead 分配，不猜 030。已有 migration 模式能承载则不另拆文件，不复制 029 安装流程 |
| 单 revision / 真实 runner 纵向接线，Lead 分配唯一 writer | `apps/server/src/plugins/commands.ts`（必要共用 revision append）、`apps/server/src/runners.ts`（host 筛选/冻结 assignment）、`apps/server/src/events.ts`（原事务来源/ref）、`packages/contracts/src/runner.ts`（binding/capability/event）、新增 `apps/runner/src/plugins/execution.ts`, `apps/runner/src/plugins/execution.test.ts`，以及实际 caller `apps/runner/src/runtime.ts`, `apps/runner/src/fixture.ts`, `apps/runner/src/configuration.ts`, `apps/runner/src/main.ts`。若 artifact 原保存接口不能直接复用，再说明 `evidence.ts` 的必要精确变更；不预占 |
| 已交付 host 双 gate，后继只消费 | `apps/runner/src/plugins/host.ts`, `apps/runner/src/plugins/host.test.ts` 已固定 `e6827d8a` 并入 main；当前 v5 持有但明确停写。中心 live grant 与 runtime caller 仍须另行协调，后续若确需改 host，先明确授权与 fresh 写权，不套用旧批准 |
| F01 导出/共用客户端/默认 mount | `packages/contracts/src/index.ts`, `packages/client/src/index.ts`, `apps/server/src/index.ts`；CLI 具体接线由 Lead 同合同安排，Web/TUI 消费这套客户端，不各造 HTTP |

13:56:33 UTC 账本及 P06 v2 release 是历史观察，不授 X01 新写权。2026-10-06 16:08:31 UTC fresh 账本确认 X01 `6ddedc73…v5 ACTIVE`，仅 host 两源与两 metadata scope；中心八源已交回，host 两源停写。须 Lead 冻结 host/公共 binding/receipt 与唯一新 SQL，然后 fresh 领取；029保留为已审材料安装，后继编号不自占。

## 验证及完整目标

未来用一个自有真实 npm fixture，公开 register/fetch/install/configure/grant/enable → public tool task → 指定真实 runRunner claim/import/invoke → 有来源 artifact/flow.text → disable，专库/动态端口/0 provider，不 mock loader。重点验证错 host 不领取、disable/新 binding 竞态和旧 pin、授权 ACK 丢失零执行、pending 取消不 completed 且 journal/ref 保留、事件冲突回滚/精确来源与中心重启读回。旧 65/14 不重计为本片证据。

原 X01-02/03/04/07 本片继续推进；v2 新 binding/v1 旧 pin、rollback、active/unknown refs 阻 remove、完整恢复审计、Web/TUI/CLI、第三方隔离、renderer/verifier/context 与 ESM 已加载版本生命周期上限仍按原 X01-05/06/08/09/10 验收，不因单包旅程缩减。方法沿本地 find-skills → codebase-design/clean-code（固定 bdacd76）；本段检查状态权威、锁顺序、取消与模块职责，0 工程测试/产品修改。

## 现成 npm 能力复用：X01-04 / X01-07 的新增明确验收

GO 于本轮要求：除自有零依赖 fixture 外，至少接入一个真实有用、来源与许可明确、版本固定的现成 npm 能力，经明确的 build-time bundle 或受控依赖方案接入 Flow Adapter。后继实施前固定所选上游包的来源、版本、许可、integrity/digest，以及 Adapter/构建输入与产物身份；记录实际能力由哪一包提供。升级需形成新包/构建身份，已有任务仍保留原冻结 pin，不能只改显示版本或复用旧通过记录。

该能力须沿同一公开 enable → 冻结 binding → 真实 runner 调用 → 有来源产物 → 独立验证链交付，并保留停用后拒绝新 binding、旧引用与未知结果语义。现 `package-store` 拒绝 `dependencies` 与 `node_modules` 是首片静态材料限制；零依赖自有 fixture 的通过不等于完整 npm 复用已验收。后继选择 bundle 或受控依赖时单独明确可复现构建、依赖与许可来源、有界材料及运行边界，不放开任意安装、安装脚本或新平台。

本轮仅归档需求，未选择或安装任何新包，没有形成新的依赖/产品 scope。质量方法沿已读本地 `find-skills`、`codebase-design`、固定 `clean-code`；检查职责、来源与执行事实的分界，保留所有原 TODO。本次零安装、工程测试、PG、SDK/provider，未改稀疏配置、缓存或旧证据。
