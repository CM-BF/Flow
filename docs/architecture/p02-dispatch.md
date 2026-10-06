# P02 持久A2A出站

2026-10-06，状态in-progress；P01-06后继的最小Task-based A2A纵向切片。沿用已核验A2A1.0.0 / @a2a-js/sdk1.3.0，不增加依赖。SDK公开库仅wire与远端policy；中心持久ownership/intent，runner承担受限执行。P01的固定官方来源和包哈希见[既有证据](../evidence/p01/manifest.json)。

## 状态与失败窗口

中心TaskSubmission为harness=a2a、protocol.endpointRef；ref只指可信host本地配置，中心不保存endpoint token。prepare同时固定规范化URL的SHA256 endpointDigest；同ref改指另一URL将拒绝，凭据本身不进入hash或中心。每attempt最多一个intent，commandId稳定随机，prepared→sending原子核对runner/task/attempt/ownerVersion和未过期租约；maySend只返回一次，重试不能再次得到true。发送请求前已持久标sending：此后任何无remoteTaskId恢复都变uncertain，可能零次发送但绝不为了进展盲重发。A2A messageId仅相关ID，不提供远端幂等保证。

已得到remoteTaskId后bind幂等保存；ACK丢失后重启只在中心确有bound时GET恢复。恢复只允许原runner、原ownerVersion、未过期当前attempt；uncertain/过期不自动续租、不GET复活，保持reservation并使用C02人工确认。取消开始同样一次性许可，取消ACK之后仍轮询Task；只有明确remote CANCELED才向中心报告cancelled。

## 公开seams

中心模块 `migrateProtocolDispatch(pool)` 在通用迁移后运行；`registerProtocolDispatch(app,pool)` 在统一鉴权hook下挂路由。以ownedAttempt保持runner→task→attempt锁序；无跨远端HTTP的数据库锁。

| 路由 | 输入 / 结果 | 权限 |
| --- | --- | --- |
| GET /api/tasks/:id/protocol | ProtocolState或null | owner |
| POST /api/runner/protocol/prepare | ProtocolPrepare（Ownership+规范化URL的endpointDigest） → ProtocolState | runner，有效ownership |
| POST /api/runner/protocol/begin | ProtocolCommand → ProtocolDispatchPermit | runner；仅prepared首次maySend |
| POST /api/runner/protocol/bind | ProtocolBind → ProtocolState | runner；重复同remoteTaskId可回放，异内容拒绝 |
| POST /api/runner/protocol/uncertain | ProtocolUncertain → ProtocolState | runner；持久标未知且停止中心新事件 |
| POST /api/runner/protocol/cancel-start | ProtocolCommand → ProtocolDispatchPermit | runner；仅第一次cancelStarted=false有maySend |
| POST /api/runner/protocol/recover | {} → ProtocolRecoverResponse | runner；最多16个，sending无ID置uncertain且不返回执行 |

合同源packages/contracts/src/protocol-dispatch.ts。ProtocolState带中心lastSequence、已保存artifact/version/verified摘要和remainingLeaseMs（服务器clock_timestamp计算剩余毫秒）。runner用单调requestStart+remainingLeaseMs减去来回时间建立保守deadline，不用跨机器墙钟相减。中心heartbeat需同样返回remainingLeaseMs，Lead共享修改。

runner模块 `runProtocolRunner({baseUrl,token,workingDirectory,signal,endpoints,pollIntervalMs?,heartbeatIntervalMs?,requestTimeoutMs?})`；endpoints为本地ref→RemoteOptions。`loadProtocolEndpoints(absoluteFile)`明确选择本地小配置文件，0自动发现凭据。由Lead的main在FLOW_A2A_ENDPOINTS_FILE模式选择，不进入通用fixture/Claude的cancel=stopped流程。

已保存outbox先重报、随后recover取最新lastSequence；EventOutbox需可选initialSequence（默认0保持兼容），由Lead共享修改。恢复通过中心artifact receipts判断是否需要补独立verification；不从远端的verification声明推断本地通过。remote inline text content进入lowerstore，title/id进入timeline，版本用本地SHA256；URL/file不自动下载。

## 明确边界

本slice为持久Task-based A2A：直接Message结果或未知payload进入明确unsupported/uncertain；MCP Tasks及MCP中心持久elicitation不在此处假装完成。P01-06其余完整预算/交互需求继续跟踪，不因为最小闭环通过删除。取消/断流/timeout均不证明远端停止。租约失效只停止本地观察/动作，不能强行宣布远端终止。所有验证0模型/云，用官方SDK peer、真实flow_p02与独立runner进程。
