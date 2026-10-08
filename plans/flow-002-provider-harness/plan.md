# Provider 登录、开源复用与 Harness 对比计划

| 字段 | 内容 |
| --- | --- |
| 计划编号 | FLOW-002 |
| 状态 | `in-progress` |
| 创建日期 / 最近更新 | 2026-10-05 / 2026-10-05 |
| 父计划 | [FLOW-001：Flow 产品与技术架构](../flow-001-architecture/plan.md) |
| 当前阶段 | 原生Claude已进入产品；下一小批收拢可替换宿主接口，并以第二个真实harness消费者验证。历史wrapper公平对照仍开放。 |

## 1. 目标、范围与已确认约束

选择适合 Flow 的 harness 接入方式，找出可以直接复用的 provider 登录和执行模块，并验证已有本机身份是否能使用。用户已要求借鉴 Hermes、T3 Code、Paseo，也已选择本机已有 Claude / Pi 登录状态作为首轮认证环境。

本计划包含源码审查、最小运行对比、能力与故障矩阵、可复用模块清单。以下首轮记录是2026-10-05历史选型实验；当时中心、数据库、Web、CLI和正式插件尚未实现，不能用作当前状态。本轮不替用户重新登录，不把凭据复制到仓库。

当前已选原生Claude作为首个产品adapter；完整认证插件接口和第二个可替换harness仍未交付。建议采用 Flow 自有的薄契约，各 adapter 可以使用最适合其能力的 SDK/RPC；统一采用 HarnessAgent 是待验证方案。

## 2. 先分清五个层次

| 层次 | 例子 | Flow 需要记录的事实 |
| --- | --- | --- |
| Provider / 模型服务 | 模型 API、订阅入口、本地模型 | 真实可用模型、额度、错误语义 |
| 身份实例 | 本机原生登录、Flow 管理的账户、API key | 凭据所有者、位置、引用、刷新责任 |
| Harness | Claude Agent SDK、Pi | 工具循环、会话、上下文、权限、扩展 |
| 接入适配层 | 原生 SDK/RPC、AI SDK HarnessAgent adapter | 事件映射、恢复句柄、能力与 usage 口径 |
| 执行环境 | 本机 worker、容器、远端 runner | 进程、文件、网络、生命周期与持久化 |

Claude 的 AI SDK adapter 内部仍调用 Claude Agent SDK，并通过 sandbox bridge 接入。Pi adapter 也复用 Pi 引擎。成对实验用于判断适配层带来的能力、部署与维护变化，不把它们当成两种独立 agent 智能进行排名。

## 3. 上游借鉴与可复用模块

审查日期为 2026-10-05；固定以下 commit，避免计划中的源码路径随上游移动。这里记录的是源代码所表达的行为，未运行这三个项目的完整测试套件。

| 项目 | 已审查版本 | 许可证 | 对 Flow 的主要价值 |
| --- | --- | --- | --- |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent/tree/8cdb91eecf59f6801e9f775fc430c73cc7d02081) | `8cdb91eecf59f6801e9f775fc430c73cc7d02081` | MIT，Nous Research | provider 认证生命周期、已有凭据复用、刷新竞争处理 |
| [T3 Code](https://github.com/pingdotgg/t3code/tree/cfa4f765ec05950a032b6c1cf9cdfff0c2391545) | `cfa4f765ec05950a032b6c1cf9cdfff0c2391545` | MIT，T3 Tools Inc. | provider 实例边界、前端无关的登录挑战、原生 SDK / RPC 适配 |
| [Paseo](https://github.com/getpaseo/paseo/tree/7a30305503c600bc46ea2a94a6750eac5cede278) | `7a30305503c600bc46ea2a94a6750eac5cede278` | Apache-2.0，第三方代码保留各自许可 | 常驻 daemon、执行会话生命周期、JSONL RPC、ACP 接入 |

### 3.1 Hermes

- [`agent/credential_persistence.py`](https://github.com/NousResearch/hermes-agent/blob/8cdb91eecf59f6801e9f775fc430c73cc7d02081/agent/credential_persistence.py)：区分自有与借用凭据，借用时保存来源元数据。适合作为 Flow `CredentialRef` 的参考。
- [`hermes_cli/auth_codex.py`](https://github.com/NousResearch/hermes-agent/blob/8cdb91eecf59f6801e9f775fc430c73cc7d02081/hermes_cli/auth_codex.py)：刷新与持久化分离，锁内重新读取以处理 token 轮换竞争；Flow 需要相应的跨 runner 所有权与刷新协调。
- [`auth_device_flow.py`](https://github.com/NousResearch/hermes-agent/blob/8cdb91eecf59f6801e9f775fc430c73cc7d02081/hermes_cli/auth_device_flow.py)、[`auth_codex_browser.py`](https://github.com/NousResearch/hermes-agent/blob/8cdb91eecf59f6801e9f775fc430c73cc7d02081/hermes_cli/auth_codex_browser.py)：device flow 轮询、PKCE、state、回调和超时，可提取小型协议逻辑。
- [`credential_lifecycle.py`](https://github.com/NousResearch/hermes-agent/blob/8cdb91eecf59f6801e9f775fc430c73cc7d02081/hermes_cli/credential_lifecycle.py)、[`auth_plugin_providers.py`](https://github.com/NousResearch/hermes-agent/blob/8cdb91eecf59f6801e9f775fc430c73cc7d02081/hermes_cli/auth_plugin_providers.py)：认证插件生命周期与 provider 注册机制。

主要为 Python、文件存储和本机配置；需要移植到 Flow 的 TypeScript / PostgreSQL 边界。Web OAuth 流程当前有内存状态，不能直接视作多实例中心的持久登录服务；其 Web 聊天中的终端嵌入也不直接满足 Flow 的原生 Web 交互目标。

### 3.2 T3 Code

- [`ProviderDriver.ts`](https://github.com/pingdotgg/t3code/blob/cfa4f765ec05950a032b6c1cf9cdfff0c2391545/apps/server/src/provider/ProviderDriver.ts)：driver 与 provider instance 分开，适合表达同一 provider 的多个账户与运行配置。
- [`ProviderAuthFlow.ts`](https://github.com/pingdotgg/t3code/blob/cfa4f765ec05950a032b6c1cf9cdfff0c2391545/apps/server/src/provider/ProviderAuthFlow.ts)：browser/device/terminal/credential 登录挑战、发起者、超时、取消、验证；可借鉴为 Web 与 CLI 共用的认证状态机。
- [`ClaudeHome.ts`](https://github.com/pingdotgg/t3code/blob/cfa4f765ec05950a032b6c1cf9cdfff0c2391545/apps/server/src/provider/Drivers/ClaudeHome.ts)：通过专用 Claude 配置目录处理实例，避免修改通用 HOME 影响 macOS Keychain 等机制。
- [`ClaudeAdapterV2.ts`](https://github.com/pingdotgg/t3code/blob/cfa4f765ec05950a032b6c1cf9cdfff0c2391545/apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts)、[`PiRpc.ts`](https://github.com/pingdotgg/t3code/blob/cfa4f765ec05950a032b6c1cf9cdfff0c2391545/apps/server/src/orchestration-v2/Adapters/PiRpc.ts)：原生 Claude query、Pi RPC 的请求关联、取消、事件与恢复。Pi `agent_end` 与真正 settled 的差异应保留到能力契约中。

优先提取小型 helper、传输和对应测试；完整 adapter 与 Effect、T3 contracts、编排系统耦合较深。Claude / Pi 接入大量复用原生身份；不能误认为 T3 实现了所有 provider 的通用 OAuth。其自有 OAuth client 注册、回调域名与服务身份也不是复制代码后自动获得的能力。

### 3.3 Paseo

- [`jsonl-rpc-process.ts`](https://github.com/getpaseo/paseo/blob/7a30305503c600bc46ea2a94a6750eac5cede278/packages/server/src/server/agent/providers/jsonl-rpc-process.ts)：请求 ID、超时、退出、stderr 与子进程生命周期，是可优先提取的模块。
- [`agent-sdk-types.ts`](https://github.com/getpaseo/paseo/blob/7a30305503c600bc46ea2a94a6750eac5cede278/packages/server/src/server/agent/agent-sdk-types.ts)：AgentClient / AgentSession、能力和持久化句柄，区分中断一轮与关闭会话。
- [`pi/cli-runtime.ts`](https://github.com/getpaseo/paseo/blob/7a30305503c600bc46ea2a94a6750eac5cede278/packages/server/src/server/agent/providers/pi/cli-runtime.ts)、[`acp-agent.ts`](https://github.com/getpaseo/paseo/blob/7a30305503c600bc46ea2a94a6750eac5cede278/packages/server/src/server/agent/providers/acp-agent.ts)：原生 CLI / ACP 适配方式，与 Flow 的协议模块相呼应。
- [`docs/agent-lifecycle.md`](https://github.com/getpaseo/paseo/blob/7a30305503c600bc46ea2a94a6750eac5cede278/docs/agent-lifecycle.md)：常驻 daemon 与客户端观察连接分离、会话恢复的边界。

Paseo 的模型认证主要依赖用户已有 CLI 登录；其 server/auth 是 daemon 身份验证，不是统一模型 provider 登录。客户端断线后的会话保留值得复用，但 daemon 重启恢复记录不等于在途工具进程与模型调用都能恢复。

### 3.4 代码采用方式

用户已允许采用合适代码。实施时按独立模块提取，记录原仓库、commit、原路径、许可证、修改点及保留的上游测试；MIT 保留版权与许可，Apache-2.0 同时处理适用声明与修改标记。实际采用哪个模块时再建立对应归属记录。本轮尚未将上游实现拷入 Flow 产品代码。

## 4. Provider / 登录模块建议

中心保存 provider 实例、认证流程和凭据引用；runner 可以使用它自己机器上的原生身份。首版允许凭据留在本机原生存储，中心只知道引用、所属 runner、可用状态和能力。远端 runner 不自动继承另一台机器的登录状态。

建议提供 `begin / challenge / status / cancel / verify / logout / refresh` 生命周期。Web 与 CLI 显示同一登录挑战；中心持久化流程 ID、发起者、目标实例、过期时间与状态，页面关闭不销毁流程。原生登录由持久 runner 持有，登录回调要明确落在哪台机器，避免 localhost 指向错误的主机。

借用身份的退出与撤销 Flow 引用应分别定义，不能默认删除用户原生登录。刷新按凭据所有者串行化，轮换后重新读取；健康检查只读取状态，不隐式启动登录或加载工具。Flow 自有凭据需要独立 secret storage 接口，数据库和普通事件保存引用。

认证插件只处理身份，不承担模型会话和任务生命周期。换账号或退出由中心协调：暂停该实例的新任务分派，由执行模块结束或显式重新绑定持有旧身份的会话，再完成身份变更，避免旧进程继续使用旧账户。登录成功、账号有额度、具体模型可调用是不同状态，分别检查。

## 5. 实验设计与版本

首轮是最小能力冒烟：只读临时 `fixture.txt`，期望 `FLOW_OK:17`；随后恢复会话并期望 `FLOW_RESUME:17`。每条路径设小回合数和 90 秒上限，不操作用户工程。使用本机已有身份，不输出凭据。

这组提示本身含有预期值 17，因此只证明工具调用、返回和恢复接口链路；不能证明未泄露答案条件下的记忆正确性。下一轮应由脚本生成未知值，恢复提示不再重复答案，并添加无历史对照。

| 项目 | 本轮版本 / 环境 |
| --- | --- |
| 宿主 | macOS，Node `v23.11.0`；实验版本，不是生产 LTS 选择 |
| AI SDK harness | `@ai-sdk/harness@1.0.139` |
| Pi adapter | `@ai-sdk/harness-pi@1.0.141`，内嵌 Pi `0.85.1` |
| Pi 原生对照 | 同一个 Pi `0.85.1`；另安装的顶层 `1.0.4` 只做发现，不用于正式成对比较 |
| Pi 模型 / 身份 | `openai-codex/gpt-5.6-luna`，Pi 已有 OAuth / 订阅身份 |
| Claude 原生 | `@anthropic-ai/claude-agent-sdk@0.3.290`，runtime `2.1.290`，请求 `sonnet`、实际 `claude-sonnet-5-5` |
| Claude adapter | `@ai-sdk/harness-claude-code@1.0.143`；内部 bridge 钉 SDK `0.3.281` / runtime `2.1.281`，与原生首轮不完全一致 |
| Pi sandbox | `@ai-sdk/sandbox-just-bash@1.0.139` 的内存文件环境；不能代替 Claude bridge 所需的端口与进程环境 |

每组记录实际模型、工具、系统上下文、版本和运行位置。Claude 与 Pi 当前使用不同模型，只能各自与对应 wrapper 比较，不能凭耗时和 token 数跨模型排名。

## 6. 首轮观察与证据

可检查的脚本与脱敏结果保存在 [experiments/harness-comparison](../../experiments/harness-comparison/README.md)。以下耗时均为单次观察，不是 p95、基准排名或性能承诺。

| 路径 | 初始工具与结果 | 初始用时 | 恢复调用 | 恢复用时 |
| --- | --- | --- | --- | --- |
| 原生 Claude SDK | Read × 1，`FLOW_OK:17` | 3449 ms | 同 session ID，`FLOW_RESUME:17`，无工具 | 2264 ms |
| 原生 Pi SDK | read × 1，`FLOW_OK:17` | 4145 ms | dispose 后从磁盘 journal 重建，`FLOW_RESUME:17`，无工具 | 1933 ms |
| HarnessAgent + Pi | read × 1，`FLOW_OK:17` | 2836 ms | stop / resumeFrom 重建，`FLOW_RESUME:17`，无实际工具调用 | 1565 ms |
| HarnessAgent + Claude | 本地容器与 bridge 依赖准备成功；创建会话时 OAuth refresh 返回 HTTP 400 | 无模型调用 | 未进入恢复测试 | — |

### 6.1 会影响契约的实际发现

1. **用量必须声明统计范围。** Pi 原生首轮合计 1325 token，恢复新增 553；Pi adapter 首轮 1179，恢复返回 1816，是会话累计值，本轮新增是 637。适配源码在完成时读取 `getSessionStats()`；直接逐轮相加会重复计入首轮。
2. **缺失字段不能视作零。** 原生 Pi 显示首轮 reasoning 12，设置 thinking off 也未使其归零；adapter 的 reasoning 详情为 undefined。Flow 保存来源、原始统计、`step / turn / session` 范围、累计水位和已知分类。水位绑定原生 session、统计来源和 generation；fork、重启或统计清零后重新核对基线，不能按整个任务或 provider 维护一个全局差值。
3. **默认发现可能加载宿主资源。** Pi adapter 的公开配置未完整阻止 context / skills 发现。本次仅在实验进程内修改资源加载器，跳过发现；原生组使用显式空资源加载器。包文件未改，HOME 未改，但这不是未经干预的开箱运行。正式插件需要受支持的资源发现控制。
4. **模型目录不代表账户权限。** Pi 的两个静态可用候选被服务端拒绝，均报告 0 token；更换为实际可用的 `gpt-5.6-luna` 后通过。不能将这些拒绝记为登录失败。
5. **官方隔离选项仍需实测。** 原生 Claude 已关闭配置来源、扩展配置和 MCP，并仅允许 fixture Read；初始化仍列出 3 个插件、17 个 skills，另有 Haiku 辅助调用。不能宣称已经去除所有内置上下文。
6. **价格估算与真实账单分开。** Claude 成功 session 最终累计 SDK 估算为 `$0.0066912`，包含恢复与辅助调用；不是订阅增量收费。恢复的累计 `modelUsage / total_cost_usd` 不能与首轮再次相加。首次测试脚本路径白名单误拒绝另有估算 `$0.0126666`，保留为实验错误，不计 SDK 能力失败。

恢复边界：Pi 两组验证的是同进程内重建 runtime；adapter 保留原内存 sandbox。Claude 验证 SDK resume 与相同 session ID。均未证明进程崩溃、跨节点迁移、浏览器断开可靠执行、长上下文质量或 100+ 并发。

系统提示、工具 schema、文件路径和隔离方式仍有差别；单次速度/token 差异不能归因于适配器，也不据此决定默认路线。

### 6.2 Claude adapter 的准备与身份解析结果

预检确认使用本机 OrbStack Docker。已有镜像缺少 bridge bootstrap 所需 pnpm；后续单独构建临时镜像补充 `pnpm 10.32.1`，没有修改原镜像。容器创建观察值 167 ms、官方 template.prepare 为 12848 ms，均不是模型调用耗时。社区 Docker sandbox adapter `0.1.2` 没有自动端口接口，通过官方允许的显式 localhost port / endpoint 接入。其上游仓库本轮访问返回 404，只能作为已检查源码的实验依赖。

创建 HarnessAgent 会话时，官方 native subscription resolver 返回 `OAuth access token refresh failed with status 400.`，没有产生模型调用，临时容器已清理。相关认证环境变量均未设置，保留环境重试不会改变这一解析路径，因此未重复刷新或重新登录。

源码显示适配器先尝试凭据文件，再回退 macOS Keychain；原生 SDK 成功不证明两者使用同一身份来源。本轮未直接读取凭据内容来定位根因，不能断言是凭据过期、权限还是解析器缺陷。bridge 另使用自己钉住的 SDK `0.3.281`，与原生 `0.3.290` 不一致。

容器依赖问题已经解决；剩余的是身份解析兼容性与版本对照。下一步优先检查 resolver 与原生 SDK 的来源选择、刷新行为及同版本差异，再运行模型和 resume，不把 HTTP 400 记为模型能力失败。

## 7. 下一轮能力与故障矩阵

| 场景 | 验证内容 | 完成证据 |
| --- | --- | --- |
| 公平原生 / wrapper 对比 | 同 harness、SDK、模型、工具、上下文、cache 条件；宿主差异单列 | 多轮样本、成功率、首次事件 / 完成延迟、token 分类及总交付成本 |
| 登录生命周期 | 已有身份、过期、刷新冲突、取消登录、多账户、不同 runner | 状态机、凭据归属、无错误删除或重复刷新 |
| 工具与权限 | 允许 / 拒绝、等待人决策、取消竞争、未知工具 | 原始与归一化事件、实际操作是否发生、恢复后的决策版本 |
| 恢复与进程边界 | 已知值不泄露的恢复题；worker 崩溃、重启、迁移 | 会话句柄、原文来源、无重复副作用；SDK 与 RPC 分别报告 |
| 前端独立性 | Web 发起后断开，CLI 重新观察 / 取消 | 任务继续、状态可回放、终态不依赖客户端在线 |
| 插件 / context | 明确 billion-context 项目后验证加载、压缩、引用还原与 fork | 明确支持的宿主版本；压缩开销与正确性不混淆 |
| 协议 | A2A / MCP / ACP 对端接入、断线、取消和产物引用 | 版本、能力与失败映射；普通时间线不内联底层内容 |
| 费用账本 | turn/session 累计、retry、resume、auxiliary calls、未知字段 | 不重复记账，原始证据可查，估算与供应商统计分开 |
| 容量 | 128 会话与模型 / 工具并发分开增加 | 资源、数据库、延迟、错误、限额与预算；不得从冒烟外推 |

## 8. 阶段、决策与完成条件

- [x] **FLOW-002-T01** 确认三项目身份、固定 commit、许可证和重点模块。
- [x] **FLOW-002-T02** 原生 Claude 小任务及 resume 冒烟。
- [x] **FLOW-002-T03** Pi 同版本原生 / HarnessAgent 小任务及 runtime 重建冒烟，记录实验干预。
- [x] **FLOW-002-T04** Claude HarnessAgent 本地容器、官方 bridge 依赖与身份解析尝试；保存 HTTP 400 失败证据。
- [ ] **FLOW-002-T05** 解决 Claude wrapper 身份来源兼容性，完成模型调用及 resume；对齐底层版本后比较。
- [x] **FLOW-002-T06** 建立 Flow 薄契约草案：能力、资源发现、权限、取消、恢复、usage 范围与原始事件引用。
- [ ] **FLOW-002-T07** 完成首个代表性工程任务及恢复/插件/权限关键场景，确定首个生产 adapter。
- [ ] **FLOW-002-T08** 选定真正采用的上游模块，提取代码与测试，记录归属和差异。

目前建议保留原生与 HarnessAgent 两条路线，优先消除资源发现、恢复与统计差异。是否统一使用 HarnessAgent、是否优先 Pi、是否采用原生 Claude，均不在本轮冒烟后直接定案。

完成本计划需要：关键能力有运行证据、明确首个生产接入及不支持项、可复用模块可追溯、后续实现任务和依赖清楚。容量与数据库性能仍按 FLOW-001 独立验证。

## 9. 参考与变更记录

- [AI SDK Harnesses](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)、[Claude Code adapter](https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code)、[Pi adapter](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi)。具体已安装版本与实际结果优先于会变化的 latest 文档。
- [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)、[Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)、[Pi RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)。
- 2026-10-05：建立独立计划，记录三项目源码复用方向、身份边界和四路线对比；使用用户选择的本机已有登录状态开始实验，保留失败探针与未验证范围。

- 2026-10-05：迁移至独立plan/status/review目录；FLOW-002-T06薄契约草案由F00提交542f70b/3995ec1提供，未将其外推为真实harness恢复或生产选型完成。

协作记录：[status.md](status.md) · [review.md](review.md)。状态按实际提交和证据更新，review模板不是通过结论。

2026-10-06 07:18 UTC维护：本片当前摘要与实际main对齐，历史实验/TODO证据保留；详见唯一status。无新产品或模型验证。

## 2026-10-06 用户优先：可替换runner宿主

- [ ] **FLOW-002-T09** 下一小批建立真正可替换的宿主Interface，并由第二个实际harness消费；单纯放宽名字/版本枚举或新增fake consumer不算完成。对应FLOW-001原模块化与REQ-06/07/12/14，不另建替代总计划。

Execution Lead汇总两端只读审查后拆最小独立片：保留既有claim、session、journal、lease、outbox、fence、verifier和默认并发保护；把adapter本地descriptor与有限可选port放在明确边界，中心继续校验已识别协议/来源和不可变profile。不能将Claude选项、字符串harness判断或会话正文来源标签扩散到宿主，也不以宽string/schema绕过能力授权。A2A保留独立持久协议driver，不伪装为本地SDK生命周期。

用户当前明确优先Claude与Codex两条真实接入路径，第二consumer优先固定Codex原生app-server；Pi和AI SDK既有研究保留，但不成为该目标的串行前置。各adapter以固定版本零provider验证其真实可用协议、事件结束/未知、取消与清理、会话locality、usage口径及不支持项。Pi同步emit没有背压，agent_end可能早于retry/compaction完成，abort需确认idle，dispose不等于停止；wrapper统计累计与本地resume限制须真实表达。具体产品slice/claim在两端审查汇总后冻结，不提前宣称Pi已接入或发起新模型调用。架构影响包括运行器本地宿主/adapter/center协议校验边界；实施交付须登记固定图更新目标并保留旧图基线。

验收保留主线CHAT09配置/pin/port保护与S01默认1/unknown admission；新能力选择只依已核descriptor/port，拒绝未识别配置。第二consumer的测试和真实native预算分开，原O10/QUEUE/R02等额度已封存。

历史动机：[AQ-01质量台账](../../docs/quality/architecture-health-2026-10-06.md)记录M1固定6434fba的P2，不冒充本轮未修bug。下一独立实现子计划R05由assignment_review在native-harness-host建立唯一source，首A保行为配置/descriptor提取；若改变terminal/unknown语义，拆独立可审子步和lease恢复直接消费者。B中心版本化来源/前进迁移；C优先固定真实Codex协议零远程query，再PG普通正文小旅程。Pi保留独立conformance候选。两条新路径均不继承未证stream/resume/steer/goal权限。

## 2026-10-06 08:57:11 UTC 用户成熟界面方向的宿主依赖

WPF-MATURE-02由Mika统筹Claude+Codex模型、thinking/effort、fast与access的真实能力链，Web负责选择与展示；FLOW-002-T09/R05负责可替换宿主与中心识别来源的契约。每个sub-task只关联一个大task，交叉依赖用链接，不复建总计划。模型目录、账号可用性、请求配置、实际响应模型与权限必须分别记录；不能用前端下拉、宽泛字符串或配置声明代替执行证据。Codex固定0.154.0 stable schema及真实initialize协商优先于latest文档；实验字段、分页/恢复、dynamicTools各自验证。此计划不新增认证、provider query或预算许可。

其余成熟界面大task由WPF-001唯一管理源维护：视觉/双主题、拖放与文件输入、context占用/压缩透明、单tab双面板/split，以及聊天/queue/steer/voice可靠性。FLOW-001总矩阵保留这些需求与跨lead依赖，不把本地descriptor提取当界面或第二harness已完成。

## 2026-10-06 生产工程目标归属

FLOW-002-T07 / REQ-06的实际源码修改、监督检查与固定产物交付统一由[ENG-001](../eng01-engineering-delivery/plan.md)规划生产子任务；E01继续保存公平harness比较输入，不复制工程实现计划。先完成当前TUI/R05基础接通，随后工程纵向片优先于COST观测扩展。只读聊天、文本child或fixture通过不能关闭T07；>=Sol模型门槛与具体provider预算保持。

## 2026-10-06T14:35:35.073416+00:00 T09后继候选：托管Codex harness

GO于本日完成官方只读研究并交付的候选输入：[Agents API architecture](https://developers.openai.com/api/docs/guides/agents-api/architecture)、[self-hosted environments](https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted)、[overview](https://developers.openai.com/api/docs/guides/agents-api/overview)。其托管Codex harness提供session/compaction/recovery，自托管exec-server主动WebSocket连接，应用消费事件/webhook；采用API费率、alpha示例与独立environment key。以上作为GO来源记录归档，本次未启动环境、安装、认证、query或兼容实验。它不是当前本机订阅或固定0.154 app-server的兼容/替代证明。

决定仍优先本机Claude+Codex；未来作为独立adapter候选，Flow保持目标、授权、预算与独立验收权威。原生harness与执行环境是否抽成独立Interface，须由两个真实消费者的需求决定，不提前建立通用层或第二Flow调度器。本次不改变T09验收、不打断O14/COST/Codex现行工作。

## 2026-10-07 T09 / 登录后继：Sign in with ChatGPT 候选

本段归档GO本轮已打开的一手研究输入：[开源/自托管token sharing](https://developers.openai.com/siwc/token-sharing-open-source)、[sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)、[app-server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)、[preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)。这是后继正式登录adapter候选；本段未独立复跑认证或验证固定0.154兼容，不能据文档推断Flow现账号可用。

该候选区分同用户/workspace的client registration与各host稳定opaque ID，不授ChatGPT历史。应用需自己的用户consent和授权持久化；初次dynamic_agent_client、callback返回issued client_id，PKCE/state/nonce及127.0.0.1 loopback均属登录Interface。不得复制其他应用OAuth client或凭据。app-server的Responses provider由应用负责refresh→restart→resume；model/list可能是bundled catalog，只有该请求成功推理才支持实际访问结论。预览约束含store:false、stream:true、本地history/resume与有限模型/API/hosted工具；voice/transcription不在此路线。

收益是正式订阅来源与多runner身份边界；代价是新增明确consent、refresh owner和预览兼容责任。当前本机Claude/Codex优先路径不变；若后续实施，Mika沿原MATURE02/FLOW002冻结最小auth接口和固定版离线兼容输入，Flow仍拥有授权/预算/验收。当前不造OAuth服务、不注册client、不读取/复制/输出token、不改已有登录、不新增query预算。

同次安全点补入GO官方[AI SDK Codex harness](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex)研究：当前wrapper经sandbox WebSocket bridge；文档Known Limitations称built-in tool approval尚不支持、要求permissionMode allow-all，host-executed AI SDK tool approval属另一层；cold-resume的apply_patch/view_image原始事件也不能完整呈现。T05/T09公平矩阵保留这两项版本绑定差异：native approval与host-tool approval、live events与cold-resumed history；tool filtering不冒权限批准，不为wrapper放宽Flow access或补造历史。Claude credentialForwarding只改转发值、不限制host discovery的候选边界沿既有E01 synthetic auth证据，未重跑实凭据探针。本段是GO来源归档，尚未核未来wrapper版本或本机适配；原生优先、Pi/AI SDK候选保留。


## 2026-10-07 T09 / R05 后继：上游 SessionStore 候选

GO已核本机SDK0.3.290声明1810–1847、6535–6671，包含SessionStore append/load、batched/eager及loadTimeoutMs；[官方Session storage](https://code.claude.com/docs/en/agent-sdk/session-storage)说明它镜像本地transcript并提供Postgres参考与conformance方向。2026-10-08补入下述固定源码研究；这是候选输入，不直接复制或声明Flow已支持跨runner会话。

优先评估该小Interface隐藏SDK私有transcript，不另造格式或搬运器。采用前必须核：双写与UUID去重、同会话租约归属、mirror_error时远端完整性与本地保留/清除、缺store的fallback、本地和远端保留，以及整段load的字节/内存界限。Flow仍持有授权/恢复权威，正文轻投影与session存储分离；不为候选引新平台。

GO只读源码固定官方仓库 `5dc91fb5ebe27e926e95d62f4b5dd7632e936e79`：[PostgresSessionStore.ts](https://github.com/anthropics/claude-agent-sdk-typescript/blob/5dc91fb5ebe27e926e95d62f4b5dd7632e936e79/examples/session-stores/postgres/src/PostgresSessionStore.ts)，Git blob `9e77f61e5cba091d2ac909a0c7b99d10f371902b`。该参考append使用普通多行INSERT、未按entry.uuid去重；load没有条数/字节上限；缺少listSessionSummaries，SDK listing helper可能逐会话load。官方文档的mirror append失败重试意味着采用前必须证明重送语义，不能把参考实现原样当可靠持久层。13项conformance未覆盖落库后ACK丢失、旧writer fencing和资源界限；可选方法缺失会直接return，PG live无环境时跳过，package test仅构造器。README明示非生产维护且未纳入仓库CI；这些是源码/测试覆盖观察，不是Flow运行故障或兼容通过。

后继仍复用SDK Interface，由中心持有PG和授权/租约，runner经有界授权port读写，不给每个runner直接数据库连接或独立pool。Flow轻聊天列表保持既有权威；opaque transcript不等于已验收正文或产物。最小零模型直接消费者需分别覆盖：落库ACK丢失后的重送、有UUID与无UUID的不同去重合同、换owner后迟到写拒绝、mirror缺口后的恢复资格、超限整段load明确拒绝。当前没有新增安装、DB或provider预算。

借用源码前还须核路径对应许可：该package.json标MIT，而仓库根LICENSE.md引用Commercial Terms，不能将整库归为MIT；本次只记录差异，未作许可适用结论或复制代码。示例SDK依赖latest不带入Flow固定版。

当前普通Claude adapter仍persistSession:true，nativeEnvironment保留既有认证配置；settingSources:[]不能当不写盘。O16一次性只读实验可在自身query装饰口评估persistSession:false并拒resume/store，但不改普通聊天恢复，也不声称其他SDK缓存/认证写入消失。具体差量与剩余登录/写入来源缺口见[O16原生阶段候选](../../../continuous-native-goal-acceptance/docs/evidence/o16/native-stages/candidate.md)。本段0安装/query/auth/DB/配置动作，不新增模型预算，当前可见发布与聊天验证优先。
