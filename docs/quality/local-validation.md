# 局部验证与交付速度

2026-10-06 02:32 UTC。使用本地 find-skills / codebase-design / clean-code；方法依据固定 pnpm9.15.4 / Vitest4.0.18 与现有 manifest，不推断未来版本能力。

| 改动面 | 可执行入口与直接影响 |
| --- | --- |
| 中心业务 | `pnpm exec vitest run apps/server/src/<affected>.test.ts`；命令/ownership/迁移改动加 server.test.ts 中对应路径 |
| Runner | 显式 `apps/runner/src/` 内受影响测试路径；outbox/control/adapter 变化覆盖其公开行为 |
| Contracts | 显式 `packages/contracts/src/<domain>.test.ts`，再选 server/client/runner/CLI 中直接消费行为；只类型检查不替代 SQL/运行时协议 |
| Client / CLI | `pnpm exec vitest run packages/client/src/client.test.ts apps/cli/src/cli.test.ts`；若只改一侧，按依赖选相应文件 |
| 协议 | `pnpm exec vitest run packages/protocols/test/<affected>.test.ts`，真实官方peer与专用PG按影响选择 |
| 产品Web | 已存在 `pnpm --filter @flow/web test` / `typecheck` / `build`；浏览器只跑相关旅程和真实共享接口集成 |
| Dashboard | 该包已有 Node tests；聚合/证明逻辑与实际临时 HTTP 验证，样式才需相关真实browser/截图 |
| 文档 / 状态 | 链接、task ID、事实/target/范围、diff，不跑全库 |

上表不是一律要运行全部命令。每次记录实际命令、选中数、通过/未选中数、专用DB/动态端口、耗时和已知边界；零测试失败，不能把无包script当通过。根fileParallelism:false暂时保留，未凭推测全局并行。后续先按耗时拆纯逻辑与独占DB集成组，再决定调度改变。

本段实例：M02因果投影修复先红1项，修后模块6/6约4.15秒，独立review选择201task/latecommit2/2；公共接口未变，没有重复全库93项。clean-code检查关注新不变量局部表达与不引入无关抽象。

2026-10-06 05:01 UTC汇总维护：find-skills本地clean-code/codebase-design复用同一管理任务，核权威owner/实际main；仅文档/相对链接/diff检查，不重跑产品或B02/CTX01负载。完整原要求未删，summary以用户可获得能力表达。
