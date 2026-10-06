# X01 enable / binding：一次 source-only 供给请求

2026-10-06 22:50 UTC。唯一任务仍 [X01](../../../plans/x01-plugin-management/plan.md)，owner architecture_read / gpt-6-astra，co-lead mika。GO授权方向已明确；这里只请求受控源码与写权，不请求新用户批准。当前产品未开工、0检查/PG/provider/import/install/build。

## 固定输入与唯一权威迁移

- Flow源码：main `60ca1942411634843fda14e158f138191b832d8b`，22:46读HEAD/main/origin相同且clean，不追moving main。旧owner启动 `3c5622ad88c34ba19535790c278c3cc941ab0a79` clean；只接本次最终metadata提交的自有docs/plan，绝不把旧owner产品blob覆盖新main。
- 新树候选 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-enable-binding`，branch `codex/plugin-enable-binding`；22:46 exact路径与branch均不存在。由Execution Lead sole provision，源码、直接消费者、规则、少量配置、唯一正式SQL源和全部自有docs合计≤5MiB。逐项路径/来源commit/blob/bytes/SHA见 [JSON清单](enable-binding-source-request.json)。本轮0deps复制，尤其不复制semver或其它node_modules；配置/lock只是只读源码输入，不是安装授权。清单含静态导入闭包与显式迁移文件，尚非可运行依赖就绪声明。
- 当前 `6ddedc73-f019-4073-b421-d23d3dc8dedd v5 ACTIVE` 保原四scope。Lead完成供给且核本次metadata后，旧owner明确停写全部原scope → 当前version `handoff(next:{lead:mika,worker:architecture_read,worktree:new,branch:new},stoppedWriting:true)` → 新树 `accept` 新version后才写。pending保留占用；不release整个claim，不同时维护两份status。
- 接收后原子amend：移出已main且停写的host.ts/host.test.ts，保两metadata并加批准首片literal；如冲突旧占用保持，先协调再写。Lead同时将dashboard X01权威来源切到新树；旧status只冻结handoff事实。现在不执行handoff/amend。

## 第一片精确源码候选（14 literal + 尚待正式分配的一份SQL）

| literal | 职责 |
| --- | --- |
| packages/contracts/src/plugin-runtime.ts | 有界host资格/enable/binding/gate/runtime读回合同；不改公共导出 |
| packages/contracts/src/plugin-runtime.test.ts | 新合同与旧operation兼容、字节/身份约束 |
| packages/contracts/src/plugins.ts | 仅公有operation kind前向增加enable/disable；旧command/投影不变 |
| apps/server/src/plugins/storage.ts | 原注册revision插入/指针/审计小接缝，供旧/新命令共用 |
| apps/server/src/plugins/commands.ts | 旧四change只调用上述复用接缝，行为不改 |
| apps/server/src/plugins/plugins.test.ts | 旧五种operation/CAS/replay/历史直接消费者回归 |
| apps/server/src/plugin-runtime/store.ts | host tuple、enable revision关联、immutable binding/phase receipt及读回；无包执行 |
| apps/server/src/plugin-runtime/commands.ts | 新enable/disable、task+binding同事务、当前grant phase gate；复用command/acceptTask/ownedAttempt |
| apps/server/src/plugin-runtime/routes.ts | 有界模块路由，复用现auth；生产不自动mount |
| apps/server/src/plugin-runtime/runtime.test.ts | 真实专库/公开模块HTTP、官方SQL约束、回滚、restart历史；未获窗口不运行 |
| apps/runner/src/plugins/execution.ts | frozen binding到原host/flow.text的窄适配，返回artifact+provenance，不另建调度/HTTP/outbox |
| apps/runner/src/plugins/execution.test.ts | 真实自有包load/invoke、两gate/错误身份/未知与有限输出；不mock loader |
| apps/web/src/plugin-management/PluginManagement.tsx | operation新增两种kind的两个审计label，无UI布局变化 |
| apps/web/test/plugin-management/browser.ts | 现audit rendering直接断言；不新建页面/运行框架 |

新 migration 编号/确切文件名由Execution Lead分配后才加入claim；033属于CHAT05P01，不能借用。只消费唯一正式DDL；前向扩008 kind CHECK、关联029 installed来源、runner/task/registration复合身份、immutable pin/phase receipt。不得修改008/029历史SQL或在fixture复制第二套DDL。

22:50:27 fresh账本：领域/runner 12 literal未见active/handoff_pending重叠；这仅观察，不是写权。当前S01P07 `9ec4dbc8 v2`持runtime、journal、runners、factory、client、contracts/index/runner-claim；CHAT05P01 `b447f2ce v1`持claude/outbox/contracts runner/server events/033；C02 `8ad6536b v2`持tasks/profile/native合同与Codex adapter。22:52:10读取Web管理源子树亦未见占用；Web audit现有fixture也作为只读输入保留。精确scope以最终take/amend时fresh账本为准。

## 共享接线与真实可用门槛

本片不改 `apps/runner/src/runtime.ts`、`apps/server/src/runners.ts`、`packages/contracts/src/runner.ts`、`packages/contracts/src/runner-claim.ts`（尚未在本次main基线）、`apps/server/src/events.ts`、`apps/server/src/reconciliation.ts`、三个index或任何client/factory/main。后继由Lead给唯一owner：当前claim能力协商/center ACK与SQL过滤 → frozen assignment strict codec → runtime dispatch/retained未知 → reportEvents provenance record → reconciliation拒绝丢binding的通用retry；F01再共享导出/client/CLI/factory。历史host tuple不能自授权当前进程；missing binding port保legacy，plugin任务不得落fixture。上述门槛未齐前生产route不mount，不创建可被旧runner执行的plugin任务。

单revision enable后冻结exact version/config/material/host；配置/版本/grant改revision则拒新binding直到重新enable。disable只拒新binding，旧pin继续但每次load/invoke检查当前tool grant。同key replay只读原结果；未知ACK不换invocation、不重复import/invoke；当前host pending未知并非已停证明，caller最终沿现journal/retained机制，不新FSM。

最少直接验收：旧5操作原形；enable CAS/并发disable/当前revision一致；错source/store/runner拒绝；binding+task+command+wake事务回滚与restart精确读回；phase1/phase2撤权或ACK未知零对应动作；真实包结果经原flow.text并保provenance。单模块通过不等公开真实runRunner链；真实semver bundle、v2/v1 pin、rollback、active/unknown refs阻remove、renderer/verifier/context及第三方隔离仍属原完整TODO。

## 方法与资源

已读本地 find-skills、codebase-design、brainstorming 和 clean-code（sickn33固定bdacd76）。按职责/状态owner/小接口审单revision、DB→host权限与错误/未知、字节界限；不复制运行FSM，不卡在重复设计审批。现资源未过运行门禁，只做Git/文件读取和小metadata，未执行任何工程check、依赖导入、安装、PG或provider。后续测试须fresh资源、独立专库/动态端口与本lead窗口；不得据source provision直接起跑。结构变更在正式交付后交Lead更新固定main架构数据，本次只登记。
