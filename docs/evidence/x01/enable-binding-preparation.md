# X01 下一片：启用与真实工具任务绑定（设计请求）

沿原 [X01](../../../plans/x01-plugin-management/plan.md)，不新增父计划。固定 main `d4a2e0a7f255a2c68b99c7aafbc006c7bc3b3b50` 的 [15 项源码输入/写权观察](enable-binding-inputs.json)；中心材料已审 `a578bfd9` 的 [集成输入](center-integration-ready.md) 独立冻结，尚未收到该片 MAIN_RECEIPT。本页仅设计，未领新产品 scope、未运行检查。

## 最小行为与复用

1. **同一 registration revision**：沿 `plugins/commands.ts:46–83` 的注册行锁、CAS、不可变 version/config/grants 和 command 审计追加 enable/disable；提取确有两个消费者的 revision append 接口，不复制更新算法。新 runtime 行只保存 desired enabled、精确已 installed operation、目标 host，不造第二套配置/grant 版本。启用要求所选版本、材料、配置、tool grant 和 host 资格一致；旧 reader 的 `runtimeStatus: unavailable` 保持兼容，新 DTO 明示语义。
2. **先固定任务再执行**：候选公开 `POST /api/plugins/:id/tool-tasks` 使用 `tasks.ts:49–58` 的 `acceptTask(tx,boss,...)`，在同一事务插入 immutable binding 与原 wake。首片是显式 ordinary fixture carrier，排除 native/engineering/resume；无需先扩通用 TaskSubmission。binding 固定 revision/config、材料/host/store/hostApi、输入 digest，中心生成 task/binding/invocation 身份。disable 与新 binding 在同注册锁序列化；disable 后拒新 binding，已受理旧 pin 继续，不用 enabled=false 改写旧 claim。
3. **host 资格单独固定**：`runners.ts:48–78` 目前只筛 harness/profile/用途，fixture 不证明能执行插件。建议 owner 确认目标 runner/store/hostApi，authenticated runner 只发布其 operator 配置的同机 store 身份；中心与 runner 各自核 allowlisted self-owned digest。宿主资格发布的最小字段及其 owner/runner 双方权威须 Lead 冻结，不能复用 native profile 冒名，也不把发布记录当实时可用性证明。claim 只核冻结 binding 与该 host 的资格/凭据，不能强断已接受旧 pin。
4. **实际调用沿现有 lease/event/journal**：新窄 runner execution 模块调用已审 `invokeInstalledTool`，先中心 `authorizeInvocation(tx,ownedAttempt,binding)` 核当时 tool grant 并持久身份，再实际 import/invoke；授权 ACK 未知不得执行。重放/恢复不因同 invocationId 再调用包，未知执行保留 refs。`host.ts:47–59` 的 `OUTCOME_UNKNOWN` 目前若直接抛入 `runtime.ts:224–239` 普通 catch 会发 failed/completed，必须以明确插件分支进入原 admission 保留路径；不伪造 NativeExecutionError、不另造调度状态机。S01 wait/drain/fatal/unknown 行为需保留。
5. **来源与验证分开**：有限 plugin receipt/provenance 通过原 reportEvents 连续 sequence/id/digest 与 ownedAttempt 事务绑定（`events.ts:79–107`），exact artifact/version 仍由 `evidence.ts:13–35` 保存并独立重算 flow.text 验证。中心只核受信 runner 报告及归属，不声称证明包内部；普通 detail 文本不是权威来源。loaded 是真实 import 观察，enabled/installed 不代替 callable。包输入/输出各沿 leaf 16KiB，首 fixture 只接受原 enum/string 配置，不能把 X02 boolean/integer 静默字符串化。

锁顺序维持 runner → task → attempt（`runners.ts:20–40`）；新调用随后锁 registration。若任务受理需锁 host runner，应先 runner 再 registration；configure/disable 不再反向锁 runner/task。沿旧 FOR SHARE fence，不做 SHARE→UPDATE 升级。执行未知明确复用现 retained admission/journal 和停止新 claim 路径，不另建 plugin 执行 FSM。取消只停止观察；lease 到期、disable、删除文件或 ESM cache 操作都不是包结束/卸载证明。

## 精确路径候选与依赖（不是领取）

| 下一片责任 | 精确 literal 候选 / 共享输入 |
| --- | --- |
| X01 领域 owner architecture_read，仍原 WT/branch | `packages/contracts/src/plugin-runtime.ts`, `packages/contracts/src/plugin-runtime.test.ts`, `apps/server/src/plugin-runtime/commands.ts`, `apps/server/src/plugin-runtime/store.ts`, `apps/server/src/plugin-runtime/bindings.ts`, `apps/server/src/plugin-runtime/routes.ts`, `apps/server/src/plugin-runtime/runtime.test.ts`；一份正式新 SQL 编号/owner 待 Lead 分配，不猜 030。已有 migration 模式能承载则不另拆文件，不复制 029 安装流程 |
| 单 revision / 真实 runner 纵向接线，Lead 分配唯一 writer | `apps/server/src/plugins/commands.ts`（必要共用 revision append）、`apps/server/src/runners.ts`（host 筛选/冻结 assignment）、`apps/server/src/events.ts`（原事务来源/ref）、`packages/contracts/src/runner.ts`（binding/capability/event）、新增 `apps/runner/src/plugins/execution.ts`, `apps/runner/src/plugins/execution.test.ts`，以及实际 caller `apps/runner/src/runtime.ts`, `apps/runner/src/fixture.ts`, `apps/runner/src/configuration.ts`, `apps/runner/src/main.ts`。若 artifact 原保存接口不能直接复用，再说明 `evidence.ts` 的必要精确变更；不预占 |
| F01 导出/共用客户端/默认 mount | `packages/contracts/src/index.ts`, `packages/client/src/index.ts`, `apps/server/src/index.ts`；CLI 具体接线由 Lead 同合同安排，Web/TUI 消费这套客户端，不各造 HTTP |

13:56:33 UTC fresh 账本：F01 v35 持三个 index；S01P06 v1 持 runtime/runtime-capacity.test.ts，已审但尚待正式 MAIN_RECEIPT；上表其余被抽查的 shared 路径无 active writer，**空闲不等授权**。当前 X01 v4 仍只持中心 8 源与两 metadata。runtime 接线须先 P06 主线接收、原 owner 停写/交回，再 fresh 领取，不覆盖既有等待修复。中心 main 接收、Lead 冻结 host 资格、公共 binding/receipt 字段与唯一 SQL 后，按最终最小职责原子 amend。未请求恢复旧 leaf 写权。

## 验证及完整目标

未来用一个自有真实 npm fixture，公开 register/fetch/install/configure/grant/enable → public tool task → 指定真实 runRunner claim/import/invoke → 有来源 artifact/flow.text → disable，专库/动态端口/0 provider，不 mock loader。重点验证错 host 不领取、disable/新 binding 竞态和旧 pin、授权 ACK 丢失零执行、pending 取消不 completed 且 journal/ref 保留、事件冲突回滚/精确来源与中心重启读回。旧 65/14 不重计为本片证据。

原 X01-02/03/04/07 本片继续推进；v2 新 binding/v1 旧 pin、rollback、active/unknown refs 阻 remove、完整恢复审计、Web/TUI/CLI、第三方隔离、renderer/verifier/context 与 ESM 已加载版本生命周期上限仍按原 X01-05/06/08/09/10 验收，不因单包旅程缩减。方法沿本地 find-skills → codebase-design/clean-code（固定 bdacd76）；本段检查状态权威、锁顺序、取消与模块职责，0 工程测试/产品修改。
