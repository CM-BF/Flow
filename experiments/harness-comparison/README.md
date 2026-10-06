# Harness 接入最小实验

日期：2026-10-05。状态：原生 Claude、原生 Pi 与 AI SDK Pi adapter 的最小实测通过；Claude adapter 的容器与 bridge 依赖准备成功，随后在订阅凭据刷新时收到 HTTP 400，未进入模型调用。

这是用于选型的 **throwaway 实验资产**，不是 Flow 产品实现，也不是可靠性、性能或模型能力基准。归档时没有再次调用模型。

## 本轮任务与结果

每条路线读取隔离目录中的 `fixture.txt`（`FLOW_FIXTURE_VALUE=17`），要求输出 `FLOW_OK:17`；首轮成功后恢复会话，要求无工具输出 `FLOW_RESUME:17`。两条提示都直接包含答案，因此结果只支持“工具调用、事件映射和恢复入口可以工作”，不能证明模型确实提取了未知信息，或会话记忆可靠。

| 路线 | 实际模型 | 首轮 / 恢复耗时 | 结果文件 |
| --- | --- | --- | --- |
| 原生 Claude Agent SDK | `claude-sonnet-5-5`（请求 `sonnet`） | 3449 / 2264 ms | [claude-native.json](results/claude-native.json) |
| 原生 Pi | `openai-codex/gpt-5.6-luna` | 4145 / 1933 ms | [pi-native.json](results/pi-native.json) |
| AI SDK Pi adapter | `openai-codex/gpt-5.6-luna` | 2836 / 1565 ms | [pi-harness.json](results/pi-harness.json) |

Claude adapter 的容器创建耗时 167 ms、bridge 依赖准备（`template.prepare`）耗时 12848 ms；随后官方 native subscription refresh 返回 HTTP 400，模型调用为 0。只证实依赖准备完成，不能据此声称 bridge 进程已启动。没有可用于该路径的环境凭据，也没有启动新登录或绕过认证。临时 container 和派生 image 已清理；其独立证据归档在 [claude-harness/](claude-harness/README.md)。这个结果定位到了认证边界，不能用于比较模型执行耗时或成功率。

以上是单次观测，计时边界、缓存、模型和工具实现不同，不能用来排名快慢或 token 效率。Claude 首轮 `wallMs` 包含 SDK 流关闭；Pi 的 `elapsedMs` 是对应 prompt/stream 阶段，初始化时间另记在 `setupMs`。

保留失败证据：

- [Claude 首次路径白名单误拒绝](results/claude-native-initial-path-guard-failure.json)：实验脚本把 macOS 的 `/tmp` 与 `/private/tmp` 当成不同路径而拒绝 Read。修正真实路径后重跑成功；这不是认证或 SDK 故障。
- [Pi / gpt-5.4-mini 模型拒绝](results/pi-native-mini-unavailable.json)：服务端表示该模型不支持当前 ChatGPT 账户接入方式。
- [Pi / gpt-5.3-codex-spark 模型拒绝](results/pi-native-spark-unavailable.json)：同类拒绝。模型元数据中出现某模型不代表当前登录有权调用它。

## 版本与实验条件

| 组件 | 本轮版本 / 使用方式 |
| --- | --- |
| Node | Claude 报告 `v23.11.0` |
| `@ai-sdk/harness` | `1.0.139` |
| `@ai-sdk/harness-pi` | `1.0.141` |
| Pi 实际执行版本 | adapter 内部依赖 `@earendil-works/pi-coding-agent@0.85.1`；原生对照也显式导入同一版本 |
| 顶层 Pi 包 | `1.0.4`，用于本轮模型发现；不是两条 Pi 执行路线的实际版本 |
| 原生 Claude Agent SDK | `0.3.290`，实际 runtime `2.1.290` |
| `@ai-sdk/harness-claude-code` | `1.0.143`；其 bridge 使用 SDK `0.3.281`，与原生版本不同，后续 Claude 对照必须保留这个混杂因素 |

[package.json](package.json) 与 [package-lock.json](package-lock.json) 原样记录本次安装依赖。它们不表示 Flow 已决定采用这些依赖；adapter bridge 自带的依赖定义也要单独检查，顶层 lock 不能消除 bridge 与原生 SDK 的版本差异。

Claude 使用 `settingSources: []`、`plugins: []`、`skills: []`、`strictMcpConfig: true`；首轮只提供 Read，并用 hook 限定 fixture，恢复时工具列表为空。虽然已关闭可配置的发现入口，初始化仍报告 3 个内置插件、17 个 skills、0 个 MCP server，因此不能宣称 runtime 完全没有自带插件或上下文。成功轮报告 thinking 为 0，但首轮存在一次 Haiku 辅助调用；初始路径误拒绝那轮在请求 thinking disabled 后仍报告非零 thinking。

Pi 原生对照使用显式空 ResourceLoader。Pi adapter 没有本轮所需的公开“关闭 skills/context 文件发现”选项，脚本使用进程内 `DefaultResourceLoader.prototype.reload` shim；没有修改安装包文件。这是实验专用隔离措施，**结果不能代表未经修改的 adapter 默认行为**。

原生 Pi 首轮使用本地文件，恢复通过关闭 session、重新打开持久化 journal、创建新 session 完成。Pi adapter 使用 JustBash 内存 sandbox，通过 `stop()` / `createSession(resumeFrom)` 恢复，并设置 `reattachInProcess: false`；仍保留同一 sandbox，未测试进程崩溃或机器重启。Claude 恢复使用相同 session ID，未测试中心调度或分布式恢复。

原生 Claude 初始化报告 `apiKeySource: none`，它不唯一标识凭据来源。原生成功、wrapper 刷新失败不能证明两条路线读取的是同一份凭据，也不能把失败直接归因于 SDK 包装层；bridge/runtime 版本、凭据存储位置与刷新路径需要单独验证。

## 用量的读法

- Claude `usage` 是当前轮主循环用量；`modelUsage` 和 `total_cost_usd` 在 resume 中含此前累计值。成功 session 最终估算为 `$0.0066912`，不要再加首轮 `$0.0031212`。首次路径错误探针的 `$0.0126666` 属于另一 session，应单列。
- Claude 的 Haiku 辅助调用出现在 `modelUsage`，只看主循环 `usage` 会漏掉它。估算美元值不是订阅实际账单。
- Pi 原生 `usagePerAssistantMessage` 是逐 assistant message 数据；Pi adapter `usage` 来自 session 累计统计，恢复轮包含首轮。归档结果已附 `usageInterpretation.resumeDelta`：输入 628、输出 9、总计 637。
- Pi adapter 本轮没有给出 reasoning 明细，而原生事件/用量出现 reasoning；不能据此断言 adapter 没有发生推理。请求 `thinking: off` 也不能代替读取实际用量。

## 源码快照与归档边界

`snapshots/` 保存实际运行源码的逐字快照，**含临时绝对路径，不是可直接运行的入口**。本目录没有提供 npm 运行命令，也没有将一次性脚本工程化。重新实验时需准备独立临时目录、替换依赖和结果路径、重建 fixture 和模型选择元数据，并确认当前授权与额度；不能直接在本目录运行快照。

- [claude-native.mjs](snapshots/claude-native.mjs)：修正真实路径后的 Claude 两轮实验。
- [claude-native-initial-path-guard-failure.mjs](snapshots/claude-native-initial-path-guard-failure.mjs)：初始路径误拒绝的原始脚本。
- [pi-eval.mjs](snapshots/pi-eval.mjs)：Pi 两条路线共用的运行脚本，模型由当时的临时发现元数据选择。
- [pi-discover.mjs](snapshots/pi-discover.mjs)：本地 SDK 模型发现脚本；最终选择另经当时可用性校正，拒绝模型及最终模型见各结果文件。

本页 `results/` 与 `snapshots/` 只按白名单复制列出的 6 份脱敏结果 JSON 和 4 份源码快照；`claude-harness/` 由对应实验单独归档。不包含凭据文件、会话 journal / transcript、`harness-resume-state.json`、模型上下文恢复内容或 `node_modules`。结果中的 session ID 仅用于关联该次实验；凭据由 SDK 使用本机已有登录自行读取，未归档其内容。

后续对照应作为独立文件添加，并补充实际 runtime、bridge SDK 版本、事件和用量映射、恢复边界及必要的测试 shim，保留现有结果不覆盖。
