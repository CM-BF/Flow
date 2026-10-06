# W01 独立审查记录

**状态：NOT_STARTED — 官方Thread/workspace新target `cb4a39211e264538704ba9d474eeb08fc4b2759c`；以下历史APPROVED不覆盖该目标。**

本记录由 W01 owner 按协调者明确回传的独立只读结论落盘；不是 owner 自审 approval。后续 metadata HEAD 不自动继承实现 SHA 的审查。

## 新整改审查入口

Review target commit：`cb4a39211e264538704ba9d474eeb08fc4b2759c`。Base commit：`b04df95821a55384c55c833e94405daaf35af8ad`（冻结基线eacee76仍祖先）。范围为官方Thread/Composer及依赖元素、新shell、split/merge与右侧AI Elements panels。Owner已完成Web模块/直接依赖检查、双主题和10项浏览器回归，独立review不得沿用以下历史目标结论。新证据见 [thread-revision/validation.md](../../docs/evidence/w01/thread-revision/validation.md)。重点看官方来源/最少适配、迟到受理关闭、每task观察隔离、草稿保留、keyboard/窄屏、模拟数据边界及依赖锁patch。

## 历史 Target 与 scope

- Review target commit：`866c20e8462f295736f685541e2ecb9ba8639101`。
- Base commit：`eacee76fa7f1b6cc46b06b57ae68458637be4a26`。
- Worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web`；branch `codex/m1-web`。
- Reviewer：外部执行分队协调者，GPT-6，只读，与实现 owner 独立；结论时间 2026-10-06 01:25 UTC。
- Scope：`apps/web/**` 的中心投影、ExternalStoreRuntime/Thread/Message、AI Elements Artifact、主题/可访问性、公共HTTP fixture验证。仅独占目录实现；根manifest/lock无差异。
- 排除真实中心、runner、harness、main集成与独立验收verifier。工作分支通过不代表 main 已具备能力。
- 关键实现：`src/projection.ts`、`src/App.tsx`、`src/TaskThread.tsx`、`src/themes.ts`、`test/projection.test.ts`、`test/journey.browser.ts`。

## 检查与证据

| 检查 | 独立执行状态 | target / 结果 |
| --- | --- | --- |
| 规则、工作树、base/head、diff、公共契约 | 已执行 | 866c20e；写入范围符合，根manifest/lock无变更 |
| 全仓typecheck | 独立重跑 | PASSED |
| 全仓tests | 独立重跑 | PASSED，13 tests，含2个R1新增回归 |
| R1公共HTTP延迟详情复现 | 独立重跑 | 修复后 `{connection:'live',loaded:true,loading:false}` |
| 延迟/失败快照恢复与修复diff | 已审 | 新增回归及selectedId/observer职责核对通过 |
| 浅深decision/verification界面 | 独立浏览 | 状态区分、主题与证据展示已查看 |
| 5项浏览器完整报告、最终截图 | 产物复核 | owner运行全部通过；reviewer未再独立运行整套浏览器 |
| 生产build / production连接页 | 产物复核 | owner通过；reviewer未独立重跑build |
| 真实中心/模型、Safari/Firefox、屏读 | 未执行 | 不在本次模拟验收通过范围 |

Owner证据：[完整验证与截图](../../docs/evidence/w01/validation.md)、[浏览器机器结果](../../docs/evidence/w01/browser-results.json)、[生产构建冒烟](../../docs/evidence/w01/production-smoke.json)、[技能/clean-code](../../docs/evidence/w01/skills-and-quality.md)、[启动说明](../../apps/web/README.md)。

## Findings 与 owner 修复

| ID | Severity | Blocking | 原target与复现 | Owner回应/修复 | 修复commit | 复审 |
| --- | --- | --- | --- | --- | --- | --- |
| W01-R1 | P2 | 已关闭 | 原target `de5f6a7e85e248e5a56f8fa619c063f4beec6ef1`：setOnline(false)调用disconnect使generation失效；延迟detail保持loading、延迟show丢失选择 | 接受；网络离线仅暂停observer，不取消选择/详情读取；保留selectedId，上线重试失败snapshot；新增两个HTTP回归 | `866c20e8462f295736f685541e2ecb9ba8639101` | 2026-10-06 01:25 UTC reviewer独立复现确认解决 |

早期未绑定commit的只读建议（detail切换generation、命令summary、hash与skip-link）均已在首个实现提交修复；这些建议不替代正式target review。

## 结论与限制

APPROVED，target `866c20e8462f295736f685541e2ecb9ba8639101`，无剩余blocking finding。批准仅限W01约定实现和fixture验证范围。真实中心/数据库持久受理、runner进程恢复、真实模型、跨机操作、Safari/Firefox和屏读未验证。后续元数据提交不能笼统声称整个新HEAD获得实现全量approval。

## 可复制的后续审查入口

```text
先核验 worktree / branch / dirty 与实际 target，阅读 AGENTS.md、plans/AGENTS.md 和 W01 plan/status/review。当前已审实现 target=866c20e8462f295736f685541e2ecb9ba8639101，base=eacee76fa7f1b6cc46b06b57ae68458637be4a26。后续metadata提交不自动沿用实现approval。按公共契约复核nextCursor、水位/reset、空page、按需详情/大历史、幂等重试、明确取消/人工decision与执行/verification分离。运行 pnpm typecheck、pnpm test、pnpm --filter @flow/web build、pnpm --filter @flow/web test:browser（Node24；测试端口5175/4318）。默认只读，发现交owner修复；结论绑定具体SHA。
```
