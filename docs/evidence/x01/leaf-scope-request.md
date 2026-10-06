# X01 首片 leaf 领取请求（待 Lead 分配，未领取）

2026-10-06 12:46:02 UTC。Mika 已 [批准依赖方向](dependency-design-review.json) `91ac13d0`：正式 `@flow/plugin-runtime` workspace，tar 精确7.5.22，prepare/read 两个入口。仍是设计批准；writer6ddedc73 v1只持原两个metadata目录。本请求不创建父计划、不提前安装或写产品。

建议 architecture_read 在唯一 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/plugin-management-plan` / `codex/plugin-management-plan` 增领以下八个新增 literal（本次均不存在，fresh账本未发现占用，但空闲不等授权）：

- `packages/plugin-runtime/package.json`
- `packages/plugin-runtime/src/package-store.ts`
- `packages/plugin-runtime/src/package-store.test.ts`
- `apps/runner/src/plugins/host.ts`
- `apps/runner/src/plugins/host.test.ts`
- `fixtures/plugins/text-tool/package.json`
- `fixtures/plugins/text-tool/index.mjs`
- `fixtures/plugins/text-tool/flow-plugin.json`

最小片只做已验证 artifact → bounded static prepare/read receipt → 固定 self-owned 无依赖包的真实 import/invoke。loader 必须消费安装receipt且复核tree/name/version/digest/hostAPI，不能直接运行任意路径；中心授权binding尚未挂载，模块测试不声称 installed/enabled/callable 的中心权威已经交付。测试使用真实tarball与真实包代码、own临时staging/安装根，路径/类型/重复/meta/展开流预算/abort/错误close/发布replay等有行为断言；不接PG/真实runner负载/provider。精确实施Interface及额外拆文件必须先确认再amend。

12:45:56 fresh ledger：`apps/server/package.json`, `apps/runner/package.json`, `pnpm-lock.yaml` 仍由 **F01 claim8470e7d2 v32** 持有。请 Lead/F01 固定这三处 workspace consumer/importer/lock 更新以及必要受控依赖准备；本owner不跨写、不借间接依赖、不私建node_modules链接。新package.json归属也请Lead明确后才与八路径一并amend。已有workspace glob覆盖packages/*；不需要修改workspace yaml。若Lead选择自己持新manifest，本owner只领其余七路径，依赖同步固定commit后开始，不能以scope[]手写依赖。

公共vertical后继仍依原 [scope-request](scope-request.md)：host/store资格、不可变revision binding、公开命令/event union、唯一migration及安装operation恢复由Lead冻结。此独立模块不会提前定义第二套中心状态权威，也不消费无来源的enabled布尔值。disable拒新binding，已受理旧binding保持pin；claim核host资格不能强断旧task。

本页是精确请求，非新进度源；实际进度只在 [status](../../../plans/x01-plugin-management/status.md)。0产品写入、0测试/PG/child/provider/安装。
