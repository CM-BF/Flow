# S01P03 可受控集成

所属大task **FLOW-001**，小task **S01P03**，co-lead **mika**。唯一 owner **status_read / gpt-6-astra**；权威 worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/runner-graceful-stop`，branch `codex/runner-graceful-stop`，唯一进度来源 `plans/s01-graceful-stop/status.md`。请 Lead 登记该来源，目录名 `s01-graceful-stop`；不将 S01 设为第三层父任务。

基线 `f181d84b5fb3652d62e2a181acff442d42b3e066`，固定实现 **`a677f2b8a22aa5ecdcc1be3709cd73a090f34702`**；其后仅本任务manifest、独审、status/review与集成说明metadata。2026-10-06 10:30:11 UTC观察 main `8d8ab520a9d43c7b9dafb22911416ee799ebf665`；本片当时尚未集成，不把已有基线能力算本次交付。最终分支HEAD以本次push/交接的Git回执为准，不能把实现target与metadata HEAD混淆。

architecture_read / gpt-6-astra 于 **2026-10-06 10:29:27 UTC** 独立只读 APPROVED，0 P1/P2；Mika另独核37项绑定。见 [manifest](manifest.json)，SHA256 `26c6fc78ee35e4e2d4f213ef35a3edad8fe03b4b2f8eec239fe24f32e1bb51e6`，以及[独审回执](independent-review.json)。2 source / 14 raw / 10 support / 11 readonly均固定target=WT=hash/bytes。

生产变更只在 `apps/runner/src/runtime.ts`：普通停止仍立刻停新领取并中断已有active；已发claim仅受内部fatal与原发送时timeout取消。明确null先持久清意图，late non-null先持久身份且不启动；真正unknown保留、无retry、无新public参数。新增 `runtime-shutdown.test.ts`，其余claim/journal/client/server/contracts/main源码与消费者断言未改。

验收证据：原1项行为red→green；最终新增10项、原runner33及capacity loopback19，共62个不同通过。4个真实PG参数实例 NOT_RUN。局部tsconfig继承根全部strict/ES2023/noUnchecked选项，noEmit0；根级类型检查因TUI/interaction依赖缺失等诊断exit2原文保留，不宣称根strict通过。首次导入失败0tests也保留。真实rename返回门控与1个自有synthetic child SIGKILL、awaitclose/同UUID/同目录restart blocked已实际断言，资源证据限制见 [resource-check](resource-check.json)。0 PG/provider/mixed运行，未补原S01 B窗。

受控合入可应用上述已审实现及纯metadata；发生手工冲突或新逻辑时回原owner，不借集成改写语义。架构影响为runtime内部取消所有权，公共字段不新增；Lead按实际合入target更新工程架构基线/registry，本owner不修改共享展示源。

writer claim `a3e307fc-a7cc-40d3-a28c-4ec3482b985a` v1保留至明确停写/交接；source、test、raw已停止修改，当前收尾仅metadata。完整未知claim恢复、强停后自动恢复、任意adapter全进程硬期限与真实容量均不在本片Done范围。主线接收后由owner补唯一status事实，不重测冻结日志。
