# W01 独立审查记录

**状态：APPROVED — 官方Thread/workspace新target `cb4a39211e264538704ba9d474eeb08fc4b2759c`；后续metadata HEAD不自动继承实现审查。**

本记录由 W01 owner 按协调者明确回传的独立只读结论落盘；不是 owner 自审 approval。后续 metadata HEAD 不自动继承实现 SHA 的审查。

## 新整改独立审查

- Review target commit：`cb4a39211e264538704ba9d474eeb08fc4b2759c`。
- Base commit：`b04df95821a55384c55c833e94405daaf35af8ad`；冻结基线 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`仍为祖先。
- Reviewer：root协调者，GPT-6，只读研究/独立审查；执行管理者d01_owner于2026-10-06 02:26 UTC明确转达正式APPROVED。Owner只转录结论，未自审approval。
- Scope：官方完整Thread和依赖、runtime/projection、shell、split/merge、主题/错误/关闭生命周期以及已单独审核的workspace panels；只限W01实现与HTTP fixture范围。
- 独立执行：Web typecheck零diagnostics、10 HTTP tests通过；核对官方Thread原始hash `64cb85b4076644dd319325b319264ec8e998e619a97c19e0f001d3fa5a03a016`与完整结构/适配diff；审shell/projection/runtime/主题/错误和关闭逻辑。
- 独立浏览：官方Composer创建decision任务queued→waiting（侧栏同步）→Approve后主pane Completed/Verified且sidebar立即Completed；此前侧栏陈旧问题已关闭。抽看light waiting/dark split和panel双主题/窄屏。
- 产物复核：完整10项browser结果、3项最终导航复验、production smoke；reviewer没有独立重跑完整browser suite/build。
- 范围核验：rootmanifest/lock与共享契约无变化。metadata `0beecc57c41d11544eab2b17047dff1c392e6908`检查时clean；metadata本身不自动成为新的全量实现审查目标。
- 结论：APPROVED，约定范围无剩余blocking finding。用户没有确认接受视觉；工程审查不等于用户接受或main集成。
- 限制：fixture不证明真实中心/runner/model/PTY/fs；reload不持久化草稿/布局，split跨父节点remount的滚动位置未保证；gzip约323KB只是已测基线，未定义设备性能预算；Safari/Firefox/屏读未验证。

新证据：[验证与全部截图](../../docs/evidence/w01/thread-revision/validation.md)、[来源与适配](../../docs/evidence/w01/thread-revision/provenance.md)、[独立panels审查](../../docs/evidence/w01/workspace-panels/review.md)。

## 本次发现与关闭

| ID | 发现 | Owner修复/证据 | 独立复核 |
| --- | --- | --- | --- |
| W01-TR1 | 仅用primitives、自制界面不符合用户完整Thread要求 | 实际复制官方registry Thread及依赖；保留完整结构及最少适配，source/hash齐全 | root核来源/结构/diff通过；不代表用户已接受视觉 |
| W01-TR2 | pending受理关闭后迟到响应可能重开/ghost观察 | generation保护与closed view guard；HTTP+browser延迟受理回归 | root源码/测试审查通过 |
| W01-TR3 | 官方Composer失败清草稿 | 无新输入时恢复原提交草稿，重试同key | root源码/10browser报告复核 |
| W01-TR4 | 已打开任务决定后侧栏旧状态 | 侧栏订阅同一权威projection，无每token盲list | root CUA新建decision→approve即时同步确认 |
| WP-R1 | FileTree键盘打开detail后焦点落body | 独立panel owner修复，commit48069af；后续属性target46a1dbd | 独立复核关闭，详见组件review |

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
先核验 worktree / branch / dirty 与实际 target，阅读 AGENTS.md、plans/AGENTS.md 和 W01 plan/status/review。当前新整改已审实现 target=cb4a39211e264538704ba9d474eeb08fc4b2759c，base=b04df95821a55384c55c833e94405daaf35af8ad；冻结祖先=eacee76fa7f1b6cc46b06b57ae68458637be4a26。后续metadata提交不自动沿用实现approval。按公共契约复核nextCursor、水位/reset、空page、按需详情/大历史、幂等重试、明确取消/人工decision与执行/verification分离。运行 pnpm --filter @flow/web typecheck、pnpm --filter @flow/web test、直接依赖packages/client/packages/contracts tests、pnpm --filter @flow/web build、pnpm --filter @flow/web test:browser（Node24；测试端口5175/4318）。默认只读，发现交owner修复；结论绑定具体SHA。
```
