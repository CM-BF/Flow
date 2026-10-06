# WPF-MATURE-04 纯投影片证据

权威[plan](../../../plans/wpf-mature-04-context-transparency/plan.md) / [status](../../../plans/wpf-mature-04-context-transparency/status.md) / [review](../../../plans/wpf-mature-04-context-transparency/review.md)。本片只有独立schema和无IO的公开metadata投影，未挂载生产API/runner/Web，不代表完整上下文透明度交付。

固定环境：Node24.20.0、pnpm9.15.4、Vitest4.0.18。复用主仓固定已安装依赖；临时配置给Vitest设置真实worktree root及Zod路径、给TypeScript继承该worktree根strict/noUncheckedIndexedAccess等配置并列4个受影响根文件。没有安装、node_modules symlink、改项目配置、provider/auth/个人服务操作。配置快照见[validation-config.json](validation-config.json)。

实际命令从`/Users/citrine/Projects/AgentHarness/Flow`执行，PATH首项`/opt/homebrew/opt/node@24/bin`：

```sh
pnpm exec vitest run --config /tmp/wpf-mature-04-vitest.config.mjs packages/contracts/src/context-transparency.test.ts apps/server/src/context-transparency/projection.test.ts
pnpm exec tsc --noEmit -p /tmp/wpf-mature-04-tsconfig.json
```

测试文件来自context-transparency工作树，不是主仓旧源码。局部noEmit继承根配置并检查这4个入口和实际transitive imports，非全库noEmit声明。

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 首次加载 | 2套件失败、0测试；模块未实现，属于预期导入失败，不冒充行为red或通过 | [red](red.txt) |
| 首次可运行 | 2文件27/27 | [first-green](first-green.txt) |
| 最终行为 | 2文件30/30，0失败/0跳过；不是把前次27再加到总数 | [final-tests](final-tests.txt) |
| 最终局部strict noEmit | exit0；空stdout文件是正常结果，结合命令/exit记录 | [final-typecheck](final-typecheck.txt)、[manifest](implementation-check.json) |
| 原始文档首片 | 7 Markdown/6 TODO/9 CT项、范围/链接/diff通过 | [document-check](document-check.json) |

行为覆盖：unknown/zero、SDK estimate来源、billing source拒绝、数值/证据约束、derived准确度；两窗口分离、partial/不可比/过期/未来/身份变化失效、next-turn settingsRevision与队列/attempt冻结、harness隔离、精确bytes但tokens未知、重复/损坏receipt拒绝、deferred/free/buffer不重算、压缩缺失不猜测、引用/全文边界及响应上限。单个正常snapshot序列化被断言低于65536bytes，未进行生产吞吐或模型精度benchmark。

文件SHA256与实际selected/pass记录见[implementation-check.json](implementation-check.json)；来源/版本见[source baseline](source-baseline.md)、[SDK hashes](sdk-source-hashes.json)；claim v2见[amend](amend-receipt.json)。独立review已由Mika/gpt-6-astra于2026-10-06 09:14:39 UTC完成：APPROVED，绑定879c989a594a8f4f266b9a78a885e311c52eca0d，无P1/P2。reviewer核4源码hash、原始证据和HEAD5741238 clean，未复跑工程测试。详见[review](../../../plans/wpf-mature-04-context-transparency/review.md)。

固定实现target：`879c989a594a8f4f266b9a78a885e311c52eca0d`。交付完整diff的空白检查对Vitest原始txt输出报告了结尾空行及一条源摘录尾空白；这些原始输出原样保留。代码/Markdown/JSON排除txt后的diff检查另核，不把原始日志空白警告写成全部diff通过，也不删改失败日志。

当前为integration阶段，main接收待mika协调。此approval只覆盖schema/纯投影，未覆盖SDK采集、持久化、权限/Web或实际服务部署；本轮仅更新metadata，不重跑已过检查。
