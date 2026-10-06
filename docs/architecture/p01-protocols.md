# P01 协议边界与接口

状态：SDK基础阶段已实现，待独立审查；完整P01继续推进。固定Node24、A2A规范1.0.0 / wire 1.0、MCP 2026-07-28。此记录不表示完整P01或跨机持久外部调度已经验收。

## 决策

采用官方 `@a2a-js/sdk 1.3.0` 与 `@modelcontextprotocol/client 2.3.1`。对端测试用A2A官方 `DefaultRequestHandler` 和MCP官方 `@modelcontextprotocol/server 2.3.1`。实际npm发布包已安装、读过接口与关键分支，并运行真实HTTP；不依据旧SDK或技能中的示例声称符合新版规范。Node HTTP只挂载A2A官方JsonRpcTransportHandler和执行鉴权/预算，SDK独占消息编解码/SSE/请求相关性。

选择此方案而非维护两套手写wire stack；Flow状态、授权、持久命令和不确定结果是本地适配职责。模块分为客户端、Flow映射与HTTP挂载，避免一个跨所有协议的抽象框架。设计已按用户/Lead授权落盘后实施，普通公开接口测试不重复索取许可。

## 公开接口

- `connectA2A({url,token?,allowLoopbackHttp?,timeoutMs?,maxResponseBytes?})` → `A2APeer`：card/send/sendStream/snapshot/list/observe/cancel；固定JSONRPC/1.0，无0.3 fallback。
- `createA2ABridge({flow,token,submission,publicUrl?,pollMs?,observationMs?})` → Node Server + `shutdown()`。submission由可信host选harness与验证策略，远端消息不能改provider/凭据/工作目录。身份为单一owner，bridge token权限等于注入FlowClient；不是多租户delegation credential。
- `connectMcp({...remoteOptions,authorizeTool?,elicit?})` → `McpPeer`：发现/分页工具、资源、资源模板、提示词/读取/调用/关闭。工具必须经过host明确授权；elicitation只在配置host处理器时声明form能力，默认不声明sampling/roots/URL elicitation，不调用模型。
- `FlowProtocolPort`只调用公共FlowClient。queryTasks公共读取由Lead提供 `GET /api/task-index`，按updatedAt/id降序cursor、同一RR快照的filtered totalSize，cursor绑定filter。bridge不直接读写中心表。

## 能力矩阵

| 协议 / role / transport | 本阶段行为 | 不支持或边界 |
| --- | --- | --- |
| A2A1.0.0 client / JSONRPC HTTP+SSE | AgentCard、直接Message与Task、发送、读取、观察、取消；真实官方handler双向测试 | 不使用REST/gRPC/0.3；push/extended card未提供；同origin端点，跨origin显式拒绝，重定向不自动转发token |
| A2A1.0.0 Flow server bridge / JSONRPC | Flow task ID=对外task ID=context ID，无内存持久关联；PG受理/decision/cancel、独立verification、artifact版本与进度 | 一任务一context；不支持任意客户端context挂接、通用聊天续写、文件输入/远程URL下载；明确错误；必需ListTasks已接公共queryTasks并通过官方SDK/PG验证 |
| MCP2026-07-28 client / Streamable HTTP | pin2026；server/discover，逐请求版本/能力meta与header；tools/resources/prompts、form input_required；单请求关闭取消、协议错误与isError区分 | 无旧initialize fallback、stdio、OAuth登录流程、URL elicitation、sampling、roots或资源订阅；host若要这些需单独配置与验收 |
| MCP io.modelcontextprotocol/tasks | 检测server extensions key；本client **supported=false，不advertise** | SDK2.3.1现代codec只接收complete/input_required；task discriminator被拒绝。官方存在2026-07-28及draft页面，不把旧实验tasks API充新版。当前不是Tasks实现或中心任务调度事实 |

## 持久性与不确定性

A2A标准只允许SendMessage幂等，不能由messageId推断远端去重。出站发送/工具调用无自动重试；网络、取消或无法解析的成功结果可能在远端已执行，返回 `RemoteOutcomeUncertainError`。已有task ID应查权威快照；没有返回task ID则必须由远端operator/持久binding核对，不能盲重发。

入站可显式传 `Idempotency-Key`：加`a2a:`命名空间后交中心持久命令，重启后可回放相同受理，异内容冲突。不传key时每次是独立命令，同messageId不承诺去重。决策data part为 `{decisionId,answer:'approve'|'reject'}`，交中心验证当前归属/幂等，不凭本地消息推测决策状态。

取消返回中心当前状态：cancel_requested仍映射working，metadata标pending；只有cancelled映射CANCELED。失联uncertain映射UNSPECIFIED并明确outcomeUncertain，不自动重派。执行完成和verificationStatus独立。观察连接退出只关闭读取，不发送cancel。

订阅前查权威快照；订阅首Task是必需的最新快照。已终态直接结束；GET/Subscribe窗口若收到官方UnsupportedOperation，重查后只有确认为终态才收束。其他错误继续失败。此过程无SendMessage重试，不承诺历史事件lossless replay。

## 有界读取

默认远端单响应/流4MiB、15秒；Node入站2MiB。Flow快照映射最多100条history，扫描上限10000事件/200详情引用、artifact原始内容合计2MiB；超过明确失败并引导公共Flow读取，不静默摘要或丢产物。metadata保留Flow watermark；只收快照水位内事件，SDK负责wire序列化。MCP自动list最多4页，所有调用保留总超时；未进行负载/SLO结论。

ListTasks默认每页50、最多100，默认轻量读取、不返回history/artifacts。过滤后的totalSize、当前页成员/顺序/状态来自中心同一RR事务；跨请求分页并非固定集合。显式展开history/artifacts时分别读取当前任务，其内容与集合索引不是整批原子快照，不能据此推断跨任务同时状态。单次列表聚合JSON预算3MiB，wire单消息4MiB。负historyLength在任何受理之前拒绝。

## 下一可执行子段

P01-06仍必做：持久外部binding与runner adapter端口；外部identity/endpoint/远端task/session/command correlation、owner fencing、发送前后状态与unknown副作用、人工elicitation进入中心决策、预算与重启恢复。禁止在此阶段用进程内map冒充持久接入。公开SDK库与入站Flow持久bridge可独立review，但不能勾完整互操作完成。

## 官方依据

- [A2A1.0.0规范](https://a2a-protocol.org/v1.0.0/specification/)：§3.1操作、§3.3.1可选幂等、§3.4context/task、§3.6版本、§13鉴权；[固定proto](https://github.com/a2aproject/A2A/blob/v1.0.0/specification/a2a.proto)。
- [官方A2A SDK](https://github.com/a2aproject/a2a-js)，npm1.3.0 gitHead `29417a5bb4038f804f310ce4fffd267a9375aa90`。
- [MCP2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)、[版本](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)、[transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)、[SDK v2迁移](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)。
- [Tasks2026-07-28](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks)与[draft](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)：按请求能力，task/update/cancel ACK与最终状态不同；本实现没有宣称支持该扩展。
