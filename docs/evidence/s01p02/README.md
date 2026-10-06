# S01P02 并发入口交付证据

当前：MAIN_ACCEPTED `f181d84b5fb3652d62e2a181acff442d42b3e066`，owner于2026-10-06 09:59:56 UTC核4源码与批准target一致；[接收证据](main-accepted.json)。main.ts写权已交回v2，个人部署/真实并发未验。以下保留准备与批准时历史观察。

固定实现target `c77fbc4e12b0ffc0ee40f597bd99c82d9b37edc7`，独立review APPROVED（Mika / gpt-6-astra，2026-10-06 09:50:43 UTC，无P1/P2）；[唯一状态](../../../plans/s01-concurrency-entry/status.md)。base4391bbf9f1785212d098ef6aa1c01a0320a003d3；09:47核main253035e11ab18ba33095c018949f856442021d49的main.ts仍与base相同，尚未集成本片，未部署/真实并发未验。claim d2c55153-7116-403d-a7db-44b10e943241 v1 ACTIVE，交付前fresh核一致，见[receipt](claim-receipt.json)。

`parseRunnerConcurrency(raw, mode)`只负责规范十进制1..16/default1及A2A仅1；Number解析后严格字符串回比，拒绝前导零、空白（含末尾换行）、科学记数、符号、小数、非数字和越界。main先调用，再读取端点/配置和发布profile；native显式传maxConcurrentAttempts，A2A保持既有选路与参数。中心registered capacity没有被修改。未改runtime/configuration/execution-profiles，不新增scheduler、状态或IO。

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 改动前main行为red | 20 selected，17失败/3通过；明确缺参/缺早拒绝，不是导入0tests | [main-red](main-red.txt) |
| 首次green | 2文件62/62 | [first-green](first-green.txt) |
| 最终行为 | 2文件64/64，42 parser+22 main，0失败/跳过 | [final-tests](final-tests.txt) |
| 首次编译命令 | exit254，WT无tsc，编译未开始 | [first-typecheck](first-typecheck.txt) |
| 首次实际编译 | exit2，临时配置缺MCP client类型路径，连带2个隐式any；未绕开source/strict | [typecheck-first-run](typecheck-first-run.txt)、[原配置](typecheck-initial-config.json) |
| 最终root严格局部noEmit | exit0，补真实已装类型路径；继承ES2023/strict/noUncheckedIndexedAccess | [final-typecheck](final-typecheck.txt)、[最终配置](validation-config.json) |

最终只运行这两个测试文件。main测试动态import真实顶层启动模块，mock configuration/profile/runtime/protocol依赖；断言default/native显式值、A2A省略/1、native与A2A非法值先于所有依赖调用、配置/guard/activeSteering传递、SIGINT/SIGTERM取消与清理、失败exitCode及固定脱敏stderr。每次恢复stub环境/exitCode并检查handler数量；全部输入为synthetic，未启动实际runner、文件端点、PG、provider或auth。mock不证明实际并发/负载。

实际命令从主仓`/Users/citrine/Projects/AgentHarness/Flow`运行，复用已安装工具；Vitest root指向本worktree，TypeScript @flow路径指向本worktree源码。没有安装/symlink，临时配置无strict/lib放宽。noEmit只限定4入口及其真实imports，不冒充完整root glob检查。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run --config /tmp/s01p02-vitest.config.mjs apps/runner/src/concurrency-configuration.test.ts apps/runner/src/main-concurrency.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit -p /tmp/s01p02-tsconfig.json
```

[source manifest](source-manifest.json)绑定4文件hash、最终实际selected/pass与历史失败；原始txt日志保持原样，空noEmit日志结合exit0判断。代码/Markdown/JSON diff空白检查排除原始txt，不把原始失败输出的空白当source问题。clean-code见[质量记录](quality.md)。实际并发/混合provider负载窗口另独审，本片不给吞吐或容量提升结论。

2026-10-06 09:52:15 UTC：批准已保存，当前待Lead集成；[唯一integration-ready receipt](integration-ready.json)绑定review、target和证据。fresh claim仍v1 ACTIVE，4源码与target一致并冻结；本轮只更新metadata，未重跑检查。当前main观察为187d97648dd2d4edf45641720f8ba771ea9f25fa clean，尚未含parser且main.ts仍与base相同；更早main观察作为历史保留。
