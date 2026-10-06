# R05-B：Claude / Codex 普通 final 接口候选

2026-10-06 09:00 UTC，assignment_review / gpt-6-astra。所属大 task：[FLOW-002](../../../plans/flow-002-provider-harness/plan.md)，co-lead：Execution Lead。本文是只读源码设计，**没有实现 B、运行 Codex、启动 app-server、读取认证或安装 SDK**。A 固定实现 `47e6943080a0d4713190c51dd5ffb234b8efd915` 保持冻结；本次读取树 `a8a2517fda7d5dffa5135b88d9b85bb3c75fcfaf`。

用户当前优先 Claude + Codex 两条路径。Codex 消费者由 Mika 核实 stable **0.154.0** 的实际协议；下列 Codex token 是待消费者确认的 Flow 命名提案，不冒称 SDK 已存在同名字段。Pi 研究保留，既不删除，也不再作为第二 harness 的必经串行门槛。

## 结论与最小接口

引入中心私有静态 `recognizedNativeSource(harness, adapterVersion, source)`：只返回受控的精确组合，未知组合拒绝；返回值仅包括 `finalPolicy`、`identityPolicy` 和 `resumePolicy`。不接受运行时插件注册、任意 string 白名单、runner 自报 capability 即获授权。A 的本地 descriptor 不成为中心信任来源。

| 精确组合 | final / identity | resume 与其他能力 |
| --- | --- | --- |
| claude / claude-sdk-0.3.290-v1 / legacy artifact | 保留现有唯一 final artifact 规则 | 原行为不变 |
| claude / claude-sdk-0.3.290-v2 / claude.sdk.result | typed final；旧 `sha256(JSON.stringify([sessionId, sourceMessageId]))` 原样 | 原行为不变 |
| codex / codex-app-server-0.154.0-v1 / codex.app-server.agent-message（候选） | typed final；新身份包含 source + 原生 session + 稳定 turn/item 身份 | 首片 resume、queue、steer、partial/native-activity、goal ports 均 unsupported，直到各自有证据 |

候选返回的 `resumePolicy` 只有明确有限值，例如 `existing-claude-local` 或 `unsupported`，不能把“final 可读”与“可恢复执行”共用一个 `knownAdapter` 布尔值。记录 session 身份仍有用，但不是恢复授权。Codex 已持久 final 不等于 task succeeded；既有 completed、artifact/version 和独立 verifier 仍决定完成与可交付，当前 runtime 终态语义不在 B 改动。

Codex 第一轮只允许显式选择同 runner、digest 正确的普通 profile；不能继承 Claude goal-tools、steering 或工程写权限。首次 turn 可受理；后续 turn/queue 在未验证 resume 前明确 409 unsupported。不把已有 conversation ID 当原生 thread ID。

## 已核源码位置与兼容约束

- `packages/storage/migrations/007-conversations.sql` 把 conversation harness 限定为 claude。`009-assistant-messages.sql` 把 source 限定为 claude.sdk.result，唯一键为 `(native_session_id, source_message_id)`。`010-execution-profiles.sql` 的 profile 不可修改，configuration 存为 JSONB；旧 digest 必须可重算，不可重写旧 JSON 后称兼容。
- `packages/contracts/src/execution-profiles.ts` 直接固定 Claude version、dontAsk、disabled 及其限额。`executionProfileConfigurationJson()` 通过 schema 固定字段顺序。新增 Codex 应采用独立严格分支；**不向旧分支注入默认 version/额外字段，不把 SDK 不提供的预算/turn/thinking 控制假填为有效值**。requested、host 限额与 actual effective 分开。Codex 控制字段的准确字面值由 Mika 实证后固定。
- `apps/server/src/execution-profiles/store.ts` 的发布/摘要、不可变同 runner profile、用途、resume 所属 runner 仍是宿主权威。`index.ts` 当前对 steering 精确单 header 协商，SQL 在 limit 前过滤。必须保留其缺失/未知/重复值与旧 hash 行为。
- `apps/server/src/assistant/store.ts` 校验 task harness、当前 attempt session、session 的 runner/active task 归属及 final ID，不能仅把字符串替换成通配。`conversations/replies.ts` 当前 session JOIN、version/source 和 legacy fallback 都是 Claude 专用；应共同消费上述静态 policy，保留 v1-only fallback，不让新 harness 用任意 artifact 冒充正文。
- `flow.sessions` 已以 `(id,harness)` 为主键（`apps/server/src/database.ts`）；通常不需要重建 session 表。新 final 的 namespace 必须与之对齐，不能跨 harness 的同名原生 ID 冲突。原始原生 ID 不静默截断；若消费者需要规范化，稳定编码与原始有界来源证据必须由 adapter 固定并验证。
- `apps/server/src/conversations/admission.ts` 当前硬编码 TaskSubmission.harness=claude；`state.ts` 全局 followUp=true/queue=true。不改这里就会把 Codex 会话派给 Claude 或误宣告续跑。`conversation-queue/commands.ts` 的 enqueue 也必须在本身入口拒绝 unsupported，不能只靠 UI 按钮。
- `apps/server/src/events.ts` final 分支复用现有 fence、顺序、重复内容比对、低层 detail、timeline；控制 final 校验对没有 steering 状态的 attempt 已无操作。`assistant-stream/settlement.ts` 没有 draft 时会记录 no-draft；这不证明 Codex 有流式能力，不因添加 final 放宽 stream/activity 的 Claude 校验。
- `packages/contracts/src/harnesses.ts` 与 `tasks.ts` 是显式枚举/profile 受理入口；新增仅 codex 字面值，不允许任意 harness。Codex usage 先维持 unknown、权威来源空列表，直到累计范围/基线/去重的实际证据成立。

## 普通 final 的 Codex 消费者最低证据

这些是 Flow 要求，不是对 stable 0.154.0 的未实测能力断言。缺任何身份或成功事实时，adapter 必须返回 unsupported / unknown，不能凑造 final。

| 字段 / 事实 | 谁提供、如何使用 |
| --- | --- |
| 固定 executable / 协议来源、adapterVersion | host 本地受控配置与版本证据；中心只认固定版本组合。stable 0.154.0 与 Flow adapter version 分开记录 |
| nativeSessionId | 实际原生 thread/session ID；先 session event 后 final，center 绑定当前 task/attempt/runner；不接受 conversation 指定权 |
| sourceMessageId | 实际稳定 turn + assistant item/message 身份组合；一个 turn 多 assistant item 必须明确 canonical final，不能取随意最后一条或仅以 thread 去重 |
| content | 实际普通 assistant 最终正文，保留中文/emoji，≤现有 1 MiB UTF-8 上限；不拼 thinking、工具结果、telemetry、子 agent 内容来凑回复 |
| completed / error / aborted 证据 | 消费者证明选定 item 已完成且所属 turn 结局适合 final；原生错误/中断/流断不伪装成功。interrupt ACK 不是进程或副作用已停止 |
| requested / effective | 请求 model、实际工具/批准/sandbox 策略和可验证的响应事实分开；未回报 model/tools/reasoning/limit 值为 null/unknown，不套用 Claude dontAsk/disabled |
| source / messageId | 固定 source 字面值；adapter 按新身份算法生成，center 独立复算；旧 Claude 算法不改。原生 ID 若有合成编码需同版本固定 |
| task/attempt/event/sequence/fence | Flow host 与 durable outbox 提供，SDK 不授予；ACK 丢失重报同事件/同正文，stale ownership 与异内容冲突照旧拒绝 |
| artifact + verification | 现有文本产物版本/digest 与 flow.text 验证独立；普通 final 本身不等于语义验收或接受交付 |

若 SDK 不提供原生 turn 成功后唯一 final item，先返回明确缺口交 co-lead 决定，不用接收任意 source 的方案绕过。Mika 可按这张表回字段与原始帧映射，不必重复研究 Flow 中心。

## 前进迁移与旧 Web

只新增一份由 Lead 预留编号的 migration；不改 007/009/010，也不倒退生产库。扩展 conversation harness/source 的有限 CHECK，final 唯一键改为 `(source,native_session_id,source_message_id)`。现有 `attempt_id UNIQUE`、detail 唯一性、外键、旧 ID/正文/日期/profile JSON 不改。新 source 采用分域身份算法；跨 source 同名原生 session/item 可并存，同 source 重复仍冲突。迁移前后保存旧 rows/摘要与重复迁移证据，不靠“空库通过”代替升级。

旧 Web `execution-profiles/selection.ts` 会把条目重新交给严格 Claude schema；直接把 Codex 混入目录将使旧 reader 失败。它创建 conversation 时还写死 harness=claude。建议新增独立精确单值协商（候选 `X-Flow-Native-Harness: codex-final-v1`），不复用/放宽现 steering header：

1. 默认仍只返回旧 reader 可读的 profiles/conversations；Codex opt-in 后才返回新联合类型。缺失/未知/重复协商值保持旧集合；filter 在 SQL limit 前，不能客户端丢条目造成空页/错误 cursor；响应 no-store，并记录协商维度。旧 Claude ordering/key/hash 不变。
2. 指定 Codex conversation 的直接 GET/turns，在没有精确协商时返回明确 406 `unsupported_native_harness`（候选状态，实施前统一 client），不伪装 Claude 或泄露无法解码的 shape；一般授权不因此扩大。客户端新增协商不等于控制权限。
3. 新 Web 显式按 profile.configuration.harness 创建，冻结原选择、profile digest 与稳定 key；reply 继续正文+有界摘要+detail ref，不新增 provider 原始帧 UI。Codex 首片没有 resume/queue/stream，能力为 false；旧 Claude 文案、fallback 和 steering 协商保留。
4. 必要 `ConversationCapabilities.followUp` 从 literal true 扩成 boolean，旧响应仍 true；新 requested/settings 是可区分的严格分支，不能强行把 Codex reasoning 改写成 Claude disabled。接收回执幂等仍返回原始 receipt，当前能力只由新 GET 表达。

上述协商是兼容实现候选，不是现 API 已支持。更少改动的备选是首片先不发布 Codex profile/conversation，仅做 typed final+PG task；这样能验证中心 seam，但不能把它叫 Web 已可使用的第二 path。

## 最小实施文件范围与交付顺序

以下是待 Lead 协调 writer 的准确路径候选，**不是当前 docs claim 扩权**。不必一次领取全部 Web 范围。公共 exports/client/mount 仍由 Lead 单写。

| 片段 | 生产最小改动范围 | 局部验收 |
| --- | --- | --- |
| B1 中心 typed final / namespace | `packages/contracts/src/harnesses.ts`、`packages/contracts/src/assistant.ts`、`packages/contracts/src/execution-profiles.ts`、`packages/contracts/src/tasks.ts`；新增 `apps/server/src/native-harness-policy.ts`；`apps/server/src/assistant/store.ts`、`apps/server/src/execution-profiles/store.ts`；新增 `packages/storage/migrations/<Lead预留>-native-harness-sources.sql`；`apps/server/src/assistant/index.ts` 挂该迁移或交共享 index | 真实旧 007/009/010 Claude rows/profile 升级、旧 hash/ID不变；跨 namespace、未知组合、session/fence、ACK 去重、错误无 final；与旧 assistant/profile 直接消费者 |
| B2 会话与兼容目录 | `packages/contracts/src/conversations.ts`；`apps/server/src/conversations/index.ts`、`apps/server/src/conversations/queries.ts`、`apps/server/src/conversations/state.ts`、`apps/server/src/conversations/commands.ts`、`apps/server/src/conversations/admission.ts`、`apps/server/src/conversations/replies.ts`；`apps/server/src/execution-profiles/index.ts`、`apps/server/src/execution-profiles/store.ts`；`apps/server/src/conversation-queue/commands.ts` | exact header 缺省/重复/未知，混合目录过滤在 limit 前、前后页 cursor、no-store；legacy v1/v2、Codex首turn/final、follow-up/queue拒绝、profile harness 不匹配；原 fixture/A2A 不变 |
| C 第二消费者与 Web 普通 final | Mika 的独立 Codex adapter scope；Lead 的 `packages/contracts/src/index.ts`、`packages/client/src/index.ts` / 测试；Web owner 的 `apps/web/src/execution-profiles/selection.ts`、`apps/web/src/execution-profiles/catalog.ts`、`apps/web/src/execution-profiles/ExecutionProfilePicker.tsx`，`apps/web/src/conversations/ConversationThread.tsx`、`apps/web/src/conversations/projection.ts`、`apps/web/src/conversations/messages.ts`，必要的 `apps/web/src/projection.ts` 默认创建逻辑 | 固定真实协议对端零远程调用 → durable outbox → 真实 PG task → 有界普通 final；新旧 Web reader 选择/冻结/cursor/正文证据；普通 workspace/task 直接读取的未知 harness 渲染也须消费检查，不将目录过滤冒称所有旧客户端兼容。真实 native/provider 另预算，不能把合成对端当模型语义 |

B1 必须配精确 Codex profile 分支后才放开普通 task admission；不必修改 generic runner 的终态、A2A driver、usage 算法或 stream/native-activity 原字段。若 Codex 可兑现的设置无法适配现 profile 控制投影，应新增有限 Codex controls 分支，由新 reader消费，而不是把旧 string 范围扩大。

旧 `apps/runner/src/runtime.ts`、`claude.ts`、outbox、lease、journal 保持当前语义；新 adapter 自身实际 loop/清理 conformance 由 Mika 另片验证。若其 settle/unknown 需求要求 host 终态改变，回到 R05-A05 独立审查，不能暗入 B/C。B2 直接消费者所需测试随各模块原测试或新私有测试领取；本次未新增/运行测试。

## 本段方法与待确认项

沿已实际读取的 find-skills / codebase-design / clean-code：两个当前 callers（final 写入、conversation 投影）共享小的静态权威 policy；配置 codec 保留版本边界；错误/未知不变成功；不创建 generic capability 引擎。仅源码读取及文档链接/范围检查，0 provider / 0 app-server / 0 auth / 0 安装 / 0 工程测试。

待 Mika 交回：真实 session/turn/item identity；普通 final 与 turn-completed/error 的映射；固定 model/sandbox/approval/reasoning controls；退出/中断可证实边界。待 Lead：新的 migration 编号、B1/B2 与 Web 的精确 claim、是否首交仅 PG final seam。所有未确认项保留 unknown，不阻 A 已批准片段集成。
