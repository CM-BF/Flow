# X01 精确接缝与领取请求（设计，未授产品写权）

唯一owner/进度见[status](../../../plans/x01-plugin-management/status.md)；完整Interface见[vertical-interface](vertical-interface.md)。**Execution Lead需分配唯一migration编号/owner，且冻结target runner/store资格、task binding、event来源字段及全局接线。当前未申请编号、未创建SQL。**

| 责任/候选owner | 精确literal候选 | 请求与依赖 |
| --- | --- | --- |
| X01领域/loader：architecture_read，原plugin-management-plan WT/branch | `packages/contracts/src/plugin-runtime.ts`, `packages/contracts/src/plugin-runtime.test.ts`, `apps/server/src/plugin-runtime/commands.ts`, `apps/server/src/plugin-runtime/store.ts`, `apps/server/src/plugin-runtime/bindings.ts`, `apps/server/src/plugin-runtime/routes.ts`, `apps/server/src/plugin-runtime/install.ts`, `apps/server/src/plugin-runtime/runtime.test.ts` | 新runtime DTO/领域安装及binding；复用X02修订/审计与原command。若实际职责需更少文件，以review后精确amend为准，不能目录claim偷扩大 |
| 同纵向runner/静态安装模块：architecture_read（仍同feature WT） | `packages/plugin-runtime/src/package-store.ts`, `packages/plugin-runtime/src/package-store.test.ts`, `apps/runner/src/plugins/host.ts`, `apps/runner/src/plugins/host.test.ts`, `fixtures/plugins/text-tool/package.json`, `fixtures/plugins/text-tool/index.mjs`, `fixtures/plugins/text-tool/flow-plugin.json` | 固定self-owned包与真实import。共享package-store以prepare/read两个小入口供center静态安装和runner只读校验；不复制两套解包/hash；需要显式库归属，见下方依赖请求；runner host只承担实际import/invoke |
| workspace/依赖接线：Execution Lead 协调 | `packages/plugin-runtime/package.json`, `apps/server/package.json`, `apps/runner/package.json`, `pnpm-lock.yaml` | [依赖补充](installation-dependency-addendum.md)：建议 shared Module 显式 tar 7.5.22，正式 workspace export/消费声明；版本已在 lock 不等于获直接依赖授权。当前未领取/安装；不借 transitive import或自写TAR |
| F01现共享owner/ExecutionLead | `packages/contracts/src/plugins.ts`, `packages/contracts/src/tasks.ts`, `packages/contracts/src/runner.ts`, `packages/contracts/src/index.ts`, `packages/client/src/index.ts`, `apps/cli/src/index.ts`, `apps/server/src/index.ts`, `apps/server/src/events.ts` | 同公开command/claim/event/client/CLI/mount。不能由X01绕过另造HTTPclient或复制union |
| 任务/runner接线待Lead协调精确owner | `apps/server/src/tasks.ts`, `apps/server/src/runners.ts`, `apps/server/src/evidence.ts`, `apps/runner/src/runtime.ts`, `apps/runner/src/fixture.ts`, `apps/runner/src/configuration.ts`, `apps/runner/src/main.ts` | admission/claim目标host+固定binding、当前动作grant、原event provenance、operator固定store；需fresh ledger重新分配，无占用不等授权 |
| X02兼容命令整合待Lead明确 | `apps/server/src/plugins/commands.ts`, `apps/server/src/plugins/storage.ts`, `apps/server/src/plugins/index.ts` | 原revision CAS/旧read兼容/新生命周期命令委派，避免两状态权威 |
| 唯一迁移：Execution Lead分配编号与writer | `packages/storage/migrations/<Lead分配>-plugin-runtime.sql`（此行是申请说明，不是可领literal） | immutable版本/revision引用、安装operation/host能力/binding/ref/audit约束；必须真实唯一DDL后PG组合，禁止测试重复CREATE合同 |
| Web/TUI owner | 后继由各端owner在各自权威树领取具体UI路径 | 消费同FlowClient/DTO；不占Web、不复制父计划。本片不能冒称已有三个端完整操作界面 |

按12:21:52 fresh账本的历史观察，F01 v31拥有runner union/index/client/events/CLI等；X01/02/04/05旧claims released。真正amend前必须再次fresh核；本页没有写权分配效力。当前X01新claim6ddedc73 v1只含两个metadata目录。

建议工程顺序：先冻结“同机store/host资格+revision绑定+operation envelope”的唯一小合同和DDL，再领域install/enable/disable/绑定与真实loader并行可审小片，随后Lead一次接公共入口、专库/真实runner纵向验收。可独立先验证静态安装/loader，但不能把模块检查当完整public vertical完成。独立review候选Mika/status_read，实施owner不可自审。

2026-10-06 12:41:21 UTC：Mika 已批准 3bd1add6 的 bounded v1 方向；[正式设计收据](vertical-design-review.json)。精确停用合同：disable 拒新 binding，已受理 task 继续固定原 pin；claim 的 host/store/hostAPI 资格核验不得顺带用 enabled=false 强断旧 task。任何不同选择先固定公开合同。安装依赖新增请求仅 metadata 提案；共享 writer/migration 仍由 Lead fresh 协调。
