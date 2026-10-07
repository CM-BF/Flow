# 工具全文公开接线：下一最小 Interface（提案，未实施）

固定输入为已接收 main `f39a5dfea0a33ef55631cb7e29291deca6d4e0d2`；本片领域交付见 [main receipt](main-receipt.json)。本文只在原 owner 的 plan/evidence 范围准备后继，不领取或修改共享源，不表示生产已开通。拟后继 CHAT05P02 属原 FLOW-001/CHAT05–06，名称、独立 worktree/base 和正式 take 由 Lead 确认；不得在原树继续产品写入。

## 最小交付与顺序

先交受现有 owner/browser 鉴权的 descriptor、分页 reader 与 factory 033 挂载，再交显式 runner host port；读口不等待 runtime 写权，两个阶段各有自己的已验证范围。最后用真实 factory + runRunner + 无 provider 的公开材料 fixture 证明闭环。Web/TUI 显示、真实 provider、宿主聚合容量另为原后继，不在本接线片中勾完。

固定源码事实：factory `apps/server/src/index.ts` 在 105 行完成 032，155 行安装既有 authentication preHandler，176 行挂 legacy activity routes；033 和新 body routes 尚未挂载。`packages/contracts/src/runner-claim.ts` 的 `runnerIdentitySchema` 是 strictObject，不能往原 identity 响应增加字段破坏旧客户端。runtime 已有唯一 admission/recovery/control/outbox；新 port 应接入这些现有流程。

## Module / Interface / 状态所有者

| Module | 小 Interface 与职责 | 生命周期、错误与依赖 |
| --- | --- | --- |
| 中心正文入口 | 复用 `migrateNativeActivityBodies`、`registerNativeActivityBodyRoutes`、原 reportEvents ingestion | factory 按 032→033→后续 migration 顺序，033 成功后才能服务新读口/确认；失败走原 factory 收尾，不能发支持声明。原 SQL 不改、不分配新 DDL |
| 共享 client reader | `nativeActivityBody(taskId, activityId, signal?)` 取轻 descriptor；`nativeActivityBodyPages(descriptor)` 创建按需 reader，`readNext(signal?)` 每次至多一页 | reader 创建零 HTTP；调用 readNext 才请求。cursor、字节校验和有界已验证材料由这一个 reader 持有；使用 FlowClient 原 transport/认证/错误类型，无第二 codec 或 fetch 栈 |
| 中心支持确认 | 新的 runner-only `GET /api/runner/native-activity-body-support` 返回固定 protocol、representation、全部六项 limits 和实际 authenticated runnerId | 既有 runner auth；no-store；只由成功挂载 033+ingestion+reader 的真实 factory 注册。不改旧 runnerIdentity/claim schema；不是权限授予或通用 capability 注册表 |
| runner 正文接缝 | `RunnerOptions.nativeActivityBodies?: boolean`，默认 false；私有 host Module 负责确认后绑定原 `HarnessContext.activityBodies` | 唯一发送者仍 EventOutbox.publishActivityBody；沿原 control/ownership、错误、admission 与恢复，不新增调度器/持久状态权威 |

### 读口鉴权和轻投影

沿原两个 `/api/tasks/:taskId/native-activities/:activityId/body` 与 `/body/chunks` 路由，必须在现有 owner/browser authenticate hook 之后挂载。无 token、错误 role、过期 browser session 遵循原拒绝规则；task/activity 组合不匹配仍 404，不能拿另 task 的 activityId 读正文。runner token 只可访问 runner 确认端点，不因此获得 owner body read 权限。

未展开的 activity list、conversation 投影和 SSE 仍只有现有轻信息；不得嵌入 chunk/base64/完整正文。legacy descriptor 诚实表示缺完整材料，不能恢复旧 64KiB 前缀外内容；complete 只代表材料完整，不代表 tool/task 成功。

### 唯一 client codec 与 consumer 契约

`nativeActivityBodyPages` 是当前 FlowClient/baseUrl 下的惰性 reader；不预取、不启动 timer，不自动重试/循环拉取。reader 的 readNext 接受 AbortSignal，已有原请求超时仍生效；开始前及返回/解码后检查取消，取消后不发布该页或继续发下一页。同一 transport 的私有限长解码接缝在 JSON 解析前限制 descriptor/支持确认为 8KiB、page 为 384KiB；越限停止读取，不把解析后的 schema 校验冒充接收字节上限。其他 client 调用不改语义。网络/畸形响应保留原 cursor 与已确认材料，不偷偷前进。caller 控制显式刷新或重新调用；不同中心/身份不能复用 reader。

该 reader 是唯一传输 codec，严格绑定 taskId/attemptId/activityId/protocol/representation/mediaType/声明 bytes/full digest/chunkCount；可变 receivedBytes/receivedChunks/state 按合法进展核对，不把整个 descriptor 的增长误判为身份变化。每页最多四块，`afterIndex` 沿现服务端语义为下一块的 inclusive index；验证 nextIndex/hasMore、连续 index 与 offset、canonical base64、每块 length/hash，以及完成时总 length/full hash。声明范围 8MiB/body、16MiB/attempt、256 材料、64KiB/chunk、8chunk/batch、4chunk/page 不变；畸形 identity、gap/overlap、hash、越界拒绝。

reader 内保留原文字节最多 8MiB，加一页有界 wire/解码临时量；不每页重新连接/解码全部前缀。完整 digest 只在完整材料核验阶段计算，不能把已验证 chunk 当完整材料。UTF8 使用流式 decoder 或完整验证后的单次 decode，64KiB 可能分割多字节字符；中间页不是独立 JSON，不能逐页 JSON.parse。原始字节完整性与文本/JSON呈现分离。多个 reader 的总保留预算和 DOM 渲染预算由 UI 后继明确限制，不能据单 reader 界限宣称全应用有界。

`receiving + hasMore=false` 仅是当前接收尾部，readNext 此次返回“仍接收中”；后续显式调用可在同 cursor 获取新页，不能永久缓存为 complete。`interrupted` 仍是不完整；只有服务端 complete 且本 reader 核完所有原文 length/digest 才可标完整。Web 原 per-pane generation/abort authority 负责阻止晚到结果进入新 pane、折叠/换 row/中心/禁用后停止新读取；client 不复制 UI lease 状态。Web 只消费共享 reader 的已验证 bytes/状态，不新增第二套 codec。完整 8MiB 可保存/取回不等于应一次性 pretty-print 或渲染 8MiB。

上述 consumer 限制来自 [Web 固定只读交接](public-wiring-web-consumer-input.json)（f39、6434B、SHA256 925a32ef8d0c231adaca3db2f954714291deec74aae4ee2be6a3745b88577bd7）；本次不修改 Web。

### 新旧中心与显式 host 开通

新的支持确认响应必须通过专用 strict schema：`protocol=native-activity-body-v1`、`representation=sdk-public-material-utf8-v1`、精确六项 limits，以及与已认证 runnerIdentity 相同的 runnerId。FlowClient 用同一 baseUrl/credentials/AbortSignal 读这个实际确认，不以 HTTP 200、route 存在、新 runner 自报、版本字符串或旧缓存猜支持。

中心只有在本次 factory 的 033 成功、原事件接纳与 body 读口已挂载后才提供确认；body read 的 owner/browser 授权和 runner 确认的 runner role 分开。root-host/CLI 默认不开启；首片由受控调用方对真实 runRunner 显式设置 nativeActivityBodies，并在固定组合中验证，不默默新增默认环境开关。本片不改 main.ts/configuration.ts，不把选项存在当已部署开通。

| 观察 | host 决策 |
| --- | --- |
| 缺显式选项 | 新模型调用不给 body port，保持 legacy；已有持久正文仍按下述恢复规则处理 |
| 已明确旧中心 404/501，且无待恢复正文 | 在模型开始前选择 legacy，不发送新 discriminant |
| 显式选项 + 当前受认证中心确认全部匹配 | adapter.run/任何新材料来源调用之前才绑定 port；保持原 assertOwnership/取消与 outbox 顺序 |
| auth 拒绝 | 走原 host-auth 停止，不吞成 legacy |
| 断连、畸形/不一致响应、查询取消等 unknown | 不提供新 port、不据此开始一次新的模型调用；沿原连接恢复等待，不重投已开始的模型 |

兼容确认不跨中心/凭据/重连复用。每个新 attempt 的 adapter 调用前重新确认；每次准备向原 report 发送含 body 事件的批次（包括 replayPending）也由同一私有 host Module 对当前中心重新确认。TOCTOU 无法靠一次 GET 消除：确认后报告失败仍按原 outbox unknown/锁后续/保留，绝不回退重建事件、清 spool 或重启模型。

只要已有 body 持久材料，即使本次选项关闭/中心变旧，也不能用 legacy 绕过恢复：body 批次缺确认就保留并阻止新 admission；原身份/eventID/sequence/fence 原样等待兼容中心，只重放原字节。一般 legacy 批次不新增 body 确认请求。共享 runtime 接缝复用 authenticatedClient 的请求跟踪、原 stop/EventStorageError 和 AttemptControl；不修改 AdmissionJournal、claim v2 或 outbox 的持久协议。新 port publish 使用原 publishActivityBody 的串行 barrier，final/成功 completed 仍不得越过未 sealed 材料。

单 attempt 限额不是宿主总内存/总磁盘保障。初次受控启用保持单 attempt/受监督字节预算；无 runner 聚合保留量、历史扫描、低空间 admission 背压与 ACK 后保留政策证据前，不默认向并发16正式开通。unknown 材料不得因超时丢弃。工具权限与隐藏 thinking 边界不变。

## 拟精确写范围与共享依赖

以下是候选 literal 清单，**尚未领取**；共 14 项。实施需 Lead 确定新的独立树/分支与 fresh base、检查当前 owner，然后 fresh take；现 v2 只保原 CHAT05P01 两项 metadata。

| 拟 literal | 改动职责 / 依赖 |
| --- | --- |
| `packages/contracts/src/native-activity-body.ts` | 支持确认及 body descriptor/page 的公开有限 schema/type；沿原协议和常量 |
| `packages/contracts/src/index.ts` | 单公开 export；Mika C02 持有，须正式移交 |
| `packages/client/src/index.ts` | 薄 transport 接线到唯一 reader 与 runner support；Mika C02 持有，须正式移交 |
| `packages/client/src/native-activity-body.ts` | 新 leaf：惰性 reader/唯一 codec，可先独立完成 |
| `packages/client/src/native-activity-body.test.ts` | 新 leaf：client transport/分页/取消/完整性直接用例 |
| `apps/server/src/index.ts` | 032 后 mount 033、既有 auth 后 mount routes/确认；X01 持有，须正式移交 |
| `apps/server/src/native-activity-body/index.ts` | 窄 runner 支持确认注册，复用现迁移/读口 |
| `apps/server/src/native-activity-body/production.test.ts` | 新 leaf：真实 factory 自动迁移/路由/auth/跨 task 拒绝，不手动 migrate/mount |
| `apps/runner/src/runtime.ts` | 显式选项与 execute/recovery/report 的小接缝；fresh 领取前再核 writer |
| `apps/runner/src/native-activity-body/host.ts` | 新 leaf：专用确认、port 绑定与 body 报告前确认，接受既有 client/outbox/control ports |
| `apps/runner/src/native-activity-body/host.test.ts` | 新 leaf：旧中心/未知/取消/缺选项与恢复直接消费者 |
| `apps/runner/src/native-activity-body/host-production.test.ts` | 新 leaf：真实 createServer+runRunner+受控无 provider adapter 的完整公开路径 |
| `plans/chat05p02-native-activity-body-wiring` | 拟后继三件套，ID/路径须 Lead 核唯一性 |
| `docs/evidence/chat05p02` | 后继自身输入/结果证据，不复制旧 raw |

06:54:13.155Z 只读 ledger：C02 claim `8ad6536b` v13 ACTIVE、X01 `6ddedc73` v11 ACTIVE；runtime.ts 当次无 writer，不等于已领取。共享移交由 Lead 协调，不能把读取失败视空闲或在旧树写。产品前像用届时一致 main 与本固定 f39 差量核对，不能将本树旧整 blob 覆盖新 C02/X01/S01 更改。

不需修改：033 SQL 内容、events.ts dispatch、spool/plan/outbox 存储、claude mapper、runner-claim/runners.ts、browser-session 权限实现、UI/附件、package/lock。它们是只读直接输入；实施若发现真实必要 delta，先精确协调 scope，不能暗扩。

## 最少验证面（本次全部 NOT_RUN）

1. Client 纯/合成 HTTP：owner 与 browser 原 transport；未调用 reader 零正文请求；descriptor 身份及 limit/offset/hash 坏页；64KiB UTF8 跨界；receiving 尾部后追加；interrupted/legacy；取消期间和 decode 后不发布/不发下一页；完整 >2MiB bytes/digest。只测新增 reader 和直接调用，不重跑已绿领域28。
2. Runner 直接消费者：原 `runtime-claim-recovery.test.ts` / `runtime-shutdown.test.ts` / `runtime-capacity.test.ts` 受改分支有选择覆盖；原 strict runnerIdentity 不变。新 host 用例证明 port 默认缺、旧中心 legacy、支持确认 identity/limits 错误拒绝、query 尚未开始时阻止、已有 body unknown 只恢复同 key/bytes、final 等 tail。无 provider/model；实际选中数在固定入口后记录，不预报已通过。
3. Factory 真实 PG：唯一自有 marker DB 和原 cleanup/OPS14，自动033及幂等启动、owner/browser/runner角色、跨 task404、轻 list/SSE零 body；复用原3PG领域结果而不重复整组。动态 SQL、实际 import/dependency 闭包纳准入；真实 PG 另排窗口。
4. 真实无 provider 组合：新 runRunner 显式 opt-in 与实际支持确认→受控 >2MiB 公开材料→现 report/outbox→FlowClient 分页 bytes 全等；lost ACK/重启复用原 envelope、模型调用计数不增、取消后状态诚实。主线组合 noEmit 覆盖公共 exports/直接消费。

读口片可先在新 leaf 完成，等待共享文件时明确接口依赖；完整 runtime 片只有真实组合证据后才可声明可开启。生产个人开通、Web/TUI 展开 UI、真实 provider、容量/保留策略均不被本提案或领域批准覆盖。实际时间/字节预算沿后继已固定必要入口复用现有 local/PG 规则，本提案不申请运行窗口。

方法复核：沿本地 find-skills、brainstorming、codebase-design、clean-code；本段是有界接口设计，0工程运行/安装。一个 reader 隐藏 codec/cursor，一个 host Module 隐藏专用协议确认；保持原 auth/outbox/状态唯一权威，未造通用 capability 或对象平台。具体优点只指职责/可审范围，不声称性能已提高。
