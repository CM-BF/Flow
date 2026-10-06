# E01 原生 / 包装层工程对照提案

状态：**PROPOSED，未授权真实执行**。2026-10-06 UTC；owner runner_owner / gpt-6-astra。auth 与 Paseo 两项已审合成证据保持不变，本文件不表示新的模型预算已生效。旧 R02/I01 5/5 额度封存。

## 本次要回答的问题

同一个受控小工程，在相同 SDK、模型请求、工具与指令下，原生 query 与 AI SDK HarnessAgent 包装路径能否完成“读取 → 修改 → 实际测试 → 产物”？记录配置、实际模型、工具动作、成败、启动/执行时间与用量映射差异。每路只有一个样本，不排名速度/成本，不推断成功率、容量或 Flow 系统已验收。

推荐 **对齐后的试验包装层**：native SDK 0.3.290 对 adapted wrapper 1.0.143 + SDK 0.3.290。保留全部补丁与原文件 hash，结论只覆盖该明确变体。另一个可行方向是原样 wrapper 0.3.281 对 native 0.3.290，但只能作两配置的观察，且 stock wrapper 没有预算透传；本次不推荐花模型额度测这个混杂对照。

## 固定输入和验收

批准后由 Astra 在专属临时根创建两个无 Flow 源码的合成 repo，初始四文件逐字相同并固定 SHA256：`SPEC.md`、`src/records.mjs`、`tests/records.test.mjs`、`package.json`。不继承任何工作项目、CLAUDE.md、用户材料或原模型会话。先由作者确认冻结测试在有意缺陷实现上失败，不能以模型自报测试成功代替结果。

任务是修复 `decodeRecords(chunks, { maxLineBytes })`：跨 chunk UTF8 中文/emoji、LF/CRLF/空行、最后一行收尾、坏 JSON，以及按 UTF8 字节计算的单行上限。只允许修改 `src/records.mjs` 和写 `RESULT.md`，其他文件只读。两路收到同一用户指令与 spec 版本/hash；不把参考实现提供给模型，不向第二路传递第一路结果。

测试通过专用无参数 `run_tests` MCP 工具执行冻结测试。工具只运行固定 Node 命令，不接受 shell/路径/环境参数；模型无 Bash、Web、Agent/Task、Skill 或任意 MCP 工具。受测代码会执行，因此测试必须在**无网络、无凭据、只挂载本次合成目录**的受限本地容器运行，不能在宿主机导入模型代码。使用已存在的本地 image 固定 digest，不拉新镜像；先验证 Node 版本、只读挂载/临时空间、进程/时间/内存限制。不满足则在模型调用前停止，不退回无隔离宿主机测试。

完成标准分开记录：模型确实改变允许的源码；至少一次工具测试的真实退出码/结果；会话停止后 Astra 独立再跑同一冻结测试；完整输入 hash 未变；最终 `RESULT.md`、代码 diff、测试日志和文件 hash 固定为 artifact manifest。源码 hash 不要求两路相同，验证行为必须相同。若失败、拒绝或超时，保存真实失败和已发生动作，不补写成成功。

## 请求的新预算与时限

| 项目 | 明确上限 |
| --- | --- |
| query 调用 | **最多 2 次**，native 1 + adapted-wrapper 1；顺序执行、新 session、不 resume/continue、不自动补跑 |
| 单次 query | `maxTurns: 8`、`maxBudgetUsd: 1`、自 query 启动起 90 秒 wall deadline |
| 总估算预算 | 两次 SDK 预算合计 **USD 2**；这是客户端估算停止阈值，不是订阅实际账单或不超支保证 |
| 越过阈值 | SDK 可在完成一次响应后才发现超额；保存实际估算。第一路已达/超 USD 1 或用量未知时不启动第二路，先回报 |
| 整次运行 | 最多 5 分钟（包括已有本地环境启动、两路 query、核验与清理）；预检/构建限 90 秒，超时回报，不扩张为安装研究 |
| 工具 | 每路最多 24 次工具调用、最多 3 次 `run_tests`；每次测试最多 10 秒、256MiB/64 PIDs；拒绝未知动作 |
| 强制停止 | 90 秒触发 SDK abort/interrupt；3 秒后终止本试验进程组，另 2 秒仍未退出则 kill；只清理本次 IDs |
| 数据 | 每路结构化证据不超过 1MiB，两路总归档不超过 8MiB；文件超限拒绝，不截断后声称完整 |

2 次 query 不等于 2 次底层 API 请求；maxTurns 内可能有多次主循环与内部辅助请求，这些都计入实际可见 `modelUsage`。一旦 query 入口被调用，该次数即消耗，不因鉴权失败、取消或无结果补回。若首路没有可信 final total，预算状态记 unknown，保留第二次，不猜零花费。真实执行须具有显式开关、批准摘要 hash、`wx` 新建执行账本与次数落盘，防止误重跑。

## 模型能力与认证边界

建议精确请求 `claude-sonnet-5-5`，这是原 R02 保存证据中曾实际返回的模型 ID；本次可用性尚未调用验证。两路均记录 init/result 的实际模型及辅助模型，不以 `sonnet` 别名当固定版本。实际主模型不符时停止，已开始的 query 仍计次数，不另试其他模型。

**不声称该 Claude 模型已被证据证明达到 Sol。** Flow repo 内方案、探针、补丁、归档均由 Astra 创建/审查；外部模型仅拟写上述独立 `/tmp` 合成 repo，不直接修改任何 Flow checkout/实验文件。此临时合成写范围和精确模型须由 Goal Owner 明确审定；若 Sol 门槛也覆盖该临时测试，则在其批准合规模型之前保留未执行，不以实验名义绕过。

拟采用本机已有用户 Claude 登录，由**官方 native SDK 子进程自行认证**。不手工读取/复制 credential store，不调用 Keychain 命令，不手工请求 refresh，不修改登录或订阅设置。wrapper 显式 `auth: {}`，源码及已保存合成测试证实这会跳过 wrapper 的订阅 resolver；本地 bridge 的 SDK 再按与 native 相同的本机登录路径处理。不要把 `apiKeySource: none` 当作两路凭据相同的证明。任何需要新的登录、导出 token、复制 home 到容器或修复旧 refresh400 的情形都停止，由负责人另行决策。

SDK 正常认证是否会自行刷新由其掌控，当前提案不授权脚本主动刷新/回写共享登录；若预检/运行报告需交互登录、登录失败或共享认证变化，停止并记录安全错误类别。不请求购买 credits，不调整账户预算。本次没有读取真实凭据来证明它当前可用。

官方支持页当前 June15 update 表明 SDK、`claude -p` 和第三方 SDK 应用仍使用现有订阅用量；其下历史“monthly credit”段落已明确暂停，不据此声称新 credit 已生效。身份和账户许可仍以用户既有登录与本次授权为前提。[官方支持页](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

## 对齐表与必须披露的试验改动

| 维度 | 两路要求 / 已核实 stock 差异 |
| --- | --- |
| Runtime | native 实装 SDK0.3.290；wrapper1.0.143 原 bridge pin SDK0.3.281 + CLI2.1.281，必须明确补丁后实装版本与实际 init version |
| System prompt | 同 `claude_code` preset + 同 append；显式 `excludeDynamicSections:true, snapshot:true`；SDK 不配置 systemPrompt 是 minimal，不等于 CLI 默认 |
| Settings | 显式 `settingSources:[]`、同 settings、plugins/skills为空、strict MCP；stock bridge 未透传 settingSources，空 skills 在发送层还可能被省略 |
| Tool surface | 同 Read/Write/Edit + 唯一 run_tests；每个 PreToolUse 在执行前核对当前试验 active、真实路径/固定工具参数；禁止出根、symlink、未知工具；模型权限不依赖默认 allow-all |
| Limits/cancel | 同 maxTurns/maxBudgetUsd 与 AbortController；stock start schema 只有 maxTurns，bridge 使用 `abortSignal`，而0.3.290公开 Options 要 `abortController` |
| Resources | 保留真实 init model/version/tool/skill/plugin/MCP 名称计数；“传空列表”不意味着零内置资源，不能伪报完全隔离 |
| Usage | 桥下捕获 SDK 每个 result 的 modelUsage/total_cost_usd/sessionId/uuid，并另留 wrapper 的 usage/metadata；不能把 wrapper 的主循环 usage 当总量 |
| Auth/state | stock helper不运行；bootstrap/session状态定位在本次私有临时根，不重设 HOME，也不写 `$HOME/.ai-sdk-harness`；native SDK 正常 session 管理由 SDK 控制 |

建议最小实验改动是固定 bundle 副本的 SDK import seam：native 和 bridge 均使用同一受控 query profile；profile 保留 async iterator 和 close/interrupt 等原接口，追加限额、取消、全工具 gate、只读观测回调。必须保存上游 SHA、逐项 patch/diff、实际 bundle/SDK/CLI hashes；禁止静默猴补丁影响共享安装。wrapper bootstrap 状态目录若无法在不改 HOME 的条件下重定位到私有根，预检直接失败；不把未完成的 full HarnessAgent 路径偷换成仅 bridge 调用来声称 wrapper 成功。

预检必须在假 query seam 下证明：两个入口参数一致、2 次计数上限、限额/取消传入、模型工具出根拒绝、只写私有 bootstrap、MCP 测试容器无网络/凭据、清理只处理本次资源。仅当这些固定代码通过独立检查、且本提案获批，才解锁真实调用。这是待实现的审核条件，不是已做检查。

## 固定 SDK / 官方资料的使用口径

已只读核实0.3.290 `sdk.d.ts`：公开配置名为 `systemPrompt.snapshot`，内部初始化协议字段才叫 `systemPromptSnapshot`；不要把后者误填成顶层 Options。默认 session 会记录初次 system prompt，resume 修改 append 不保证立即生效。后续约束变化须显式新用户消息/受理版本并由工具 gate enforce，不把改 append 当权限撤销。本次用两个 fresh session，不测恢复。[官方 system prompt 文档](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)

`usage` 只覆盖主循环；`modelUsage` 覆盖 query pipeline 的累计用量，仍排除部分 pipeline 外 helper，不是精确全账户账单。新 session 读 final total；同 session resume 若有持久 baseline 已包含历史，不能直接相加；`/clear` 会重置。maxBudgetUsd 约束本 query 启动/clear 后增量，不能代替 Flow 的跨任务预算；崩溃/缺 baseline 用 unknown/incomplete。stock bridge 当前从 success 的 usage 做映射，没有保留 modelUsage，因此对照必须同时保留 SDK 原统计与 wrapper 展示统计。[官方 cost 文档](https://code.claude.com/docs/en/agent-sdk/cost-tracking)

本地声明中某些 snapshot rollout 注释落后于当前官方页；报告原始版本/实际配置，不凭注释推定账户启用情况。配置相同也不能消除时间、缓存、随机采样和路径上下文差异，只记录一次受控对照。源码位置与 SHA256 见 [comparison-source-hashes.json](../../docs/evidence/e01/comparison-source-hashes.json)。

## 交付与当前未执行项

批准后交付代码 target、完整 patch/provenance、每路独立不可覆写 observations、artifact manifest/diff/冻结测试、预算账本与清理结果。SDK原始事件仅保存合成任务所需白名单字段；不归档凭据、环境全量、session transcript、bridge resume token 或无筛选 stderr。错误只留允许的类别/状态码，日志先限字节再脱敏，敏感路径不回显。

当前仅源码/文档核对和提案：真实 query=0、真实 refresh=0、未启动新 wrapper/测试容器。两项合成观察原 hash 未改。等待 Goal Owner 批准：新 2 次预算/阈值与可能单响应超额、精确模型及临时合成写范围、适配后 wrapper 的比较口径，以及官方 SDK 自行使用已有登录的认证方式。批准不构成对 Flow 产品工程写权限或最终 harness 选型的批准。
