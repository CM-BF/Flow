# R06 Interface v1

状态：实现合同；所属 FLOW-002。固定 Codex 0.154.0 stable schema 来源在 provenance.json。模块 import：`apps/runner/src/codex/index.ts`。

## 唯一职责与公开端口

`createCodexTransport({spawn:{executable,args,cwd,environment}, initialize:{clientInfo,capabilities}, limits?, signal?})` 同步创建 owned child 及 handle。

- `ready: Promise<ReadyInfo>`：initialize response 成功且 initialized notification 写入完成才 resolve。返回 userAgent/platformFamily/platformOs，去除 codexHome。ready 前普通 request/reply 拒绝。
- `request(method, params, {signal?,timeoutMs?}?)`：成功返回 opaque JSON result；失败 `CodexTransportError` 只含固定 code、delivery（not-sent / unknown / remote-error）及可选 rpcCode，不复制远端 error message/data。
- `receive(): Promise<Inbound | null>`：单 consumer 拉取有界通知/服务器请求；{kind,method,params,id?}。无模型/turn解释。关闭且已接受队列消费完后 null。第二个并发 receive 拒绝；overflow 关闭，不丢帧冒正常。
- `respond(id, {result} | {error:{code,message}})`：仅回应本连接已交给 consumer 的 outstanding server request。promise 仅证明本地写入；不等远端应用。method 不开放普通 notify；initialized 由 transport 唯一发送。
- `close(): Promise<CloseReport>` / `closed`：幂等有界 TERM→KILL，仅所持 ChildProcess handle；报告 confirmed/unconfirmed、exitCode/signal/reason，remoteEffects:'unknown'。不杀端口、不扫描 PID、不自动恢复/retry。
- `snapshot()`：state、owned PID、pending/queue 当前与峰值 byte/count、stderr 总 byte（饱和计数，无内容）、unansweredRequests（包括 unknown 仍占额度）。用于局部资源证据，不导出请求参数。

## 状态 / 身份 / 容量

starting→ready→closing→closed；首次 terminal reason 保留。初始化/请求 deadline 不被新帧重置。客户端数值 ID 单调且不复用；已发送但超时/取消的 unknown 请求继续占并发额度，直到实际迟到响应或连接关闭，不通过连续取消突破上限；晚到/重复旧 response 忽略，不再次结算；未来/错误类型 ID 协议拒绝。server request ID 按 string/number 分开，未回应数量有界，重复 ID 不自动执行。

默认每帧 1 MiB（UTF8 bytes，不含 newline）、写队列 2 MiB / 64 帧、读队列 2 MiB / 64 帧、inflight client 和 server requests 各 32。hard maximum：帧 4 MiB、双向队列各 8 MiB / 256 帧、client/server 各 128；JSON 输入最大深度 64。默认 request/write deadline 15s、完整 initialize deadline 10s、TERM/KILL 各 1s；最大 request/write 90s、initialize 30s、TERM/KILL 各 5s。只在 write callback 与 drain 满足后发下一帧；本地排队超时取消可证明 not-sent，交给 stdin 后失败只能 unknown。stdout 分片/合并均支持，UTF8非法/无换行过界/EOF半帧/JSON或envelope非法关闭。stderr仅有界计数，不收集rawtrace。

显式 spawn 使用绝对 executable/cwd、shell:false、仅 pipe stdio、不合并 process.env。environment 仅 system locale/path/home/temp + CODEX_HOME 白名单，未知 key 拒绝；不输出环境值。macOS 可由系统追加 __CF_USER_TEXT_ENCODING，合成检查明确保留该观察；模块本身不传父环境。生产合法认证来源由后继宿主决定。本模块不防止受信程序自己访问系统，不是 sandbox。

## 扩展与验证

后继 adapter 只组合 request/receive/respond/close，将模型/turn/approval/fencing 语义留在领域；不改 transport 增加 harness 类型分支。真实 Codex schema 兼容由 Mika/R05B 独立验收。此片全部合成 Node 子进程，不启动真实 app-server、认证或 provider。超时/close 不发 interrupt、不宣称外部副作用停止。

## 实现层次与失败处理

| Module | 职责 / 依赖 |
| --- | --- |
| index.ts | 唯一连接/请求状态所有权；组合 Node child_process、decoder/writer；不读 Flow 数据 |
| framing.ts | 固定 byte buffer + fatal UTF8 JSONL；仅序列化有界 JSON 数据，不调用 toJSON/getter |
| writer.ts | 单 active write，callback + drain 后推进，计入双界，write deadline 有界 |
| options.ts / types.ts | 配置 hard maximum/环境白名单与小公开契约；无第三方依赖 |

失败后的 accepted inbound queue 保留为有界历史，可 receive 至 null；它不代表远端活动仍进行。consumer 必须同时观察 closed.reason。server-request 在关闭后不能 respond。未证实的 local child 关闭返回 unconfirmed，无自动重试/启动替代进程。signal 仅处理本地 await/connection，consumer 的原生 interrupt/模型取消由下一层显式协议决定。
