# O06 公开 Interface

合同 commit `f48434d8d9ca53813d2bfaf0783135193121138e`（初版cf3f8028a566226b7daa817d7dfea618085ac749）；完整领域target `f6ba02e8898ed1539786de381c41402d342e59a8`。领域基于 main eb14991a170b72d7d974428b2e440e1faada2c1e；017 模块独立挂载，当前未声明生产接入。类型见 packages/contracts/src/goal-graph-runs.ts。

共享挂载：先既有 012/013/014，再 `migrateGoalGraphRuns(pool)`（版本017幂等）；在 Fastify ready/listen 前 `registerGoalGraphRunRoutes(app,pool,boss)`。复用 createServer 全局 owner/runner auth。调用方不能提供 SQL 表名/actor。无新环境变量或依赖。

| HTTP | 权限 / 输入 | 成功结果 |
| --- | --- | --- |
| POST /api/goals/:id/graph-runs | owner，GoalGraphRunAdmission，Idempotency-Key | 201 GoalGraphRunAccepted：{run,task,replayed} |
| GET /api/goal-graph-runs/:id | owner | 200 GoalGraphRun |
| POST /api/goal-graph-runs/:id/revoke | owner，{reason}，Idempotency-Key | 200 GoalGraphRunRevoked：{run,changed,replayed} |
| GET /api/goal-graph-runs/:id/calls?after=0&limit=20 | owner，after 为序号≥0，limit 1..50 | 200 GoalGraphAuditPage：{run,calls,nextCursor:number或null} |
| POST /api/runner/goal-graph/grant | runner，Ownership {attemptId,ownerVersion} | 200 GoalGraphRun |
| POST /api/runner/goal-graph/read | runner，GoalGraphReadCall：Ownership+grant{id,version:1}+after?+limit? | 200 GoalGraphReadPage |
| POST /api/runner/goal-graph/proposal | runner，GoalGraphDetailCall：Ownership+grant+proposalId | 200 GoalGraphDetailResult：{id,proposalDigest,baseRevision,input} |
| POST /api/runner/goal-graph/command | runner，GoalGraphCommandCall：Ownership+grant+command，Idempotency-Key | 200 GoalGraphCommandResult |

GraphReadPage 包含 goalId/projectId/baseRevision/currentRevision/stale/nodes[{id,title,version}]/nextCursor。默认20、上限50，cursor绑定grant/project/baseRevision。读取整个已授权goal的base graph；allowedExistingNodes限制依赖引用写权限，不是节点读取隔离。所有页永远读取固定baseRevision，不混当前图；最新不同则stale=true。

command判别联合：propose={kind:'propose',proposal:GoalGraphProposalInput}；apply={kind:'apply',proposalId,expectedProjectRevision,proposalDigest}。返回propose={kind:'propose',proposal:GoalGraphProposalSummary,replayed}，无input全文；apply={kind:'apply',receipt,alreadyApplied,replayed}。actor与source为owner literal或可信GraphRunActor {kind:'goal-graph-run',runId,runnerId,taskId,attemptId,ownerVersion}，不可从HTTP指定。G01 ProjectRevision 的actor扩为owner|goal-graph-run，后者含actorSource；旧owner响应不新增actorSource。

详情input是完整原文，不静默截断；proposal入库前JSON UTF-8≤65,536 B，同时≤16节点/128边/reason≤4,000字符/title≤180字符。runner command整个HTTP body上限70,000 B（含ownership封装），细节响应最多该有界input加固定元数据。没有LLM token或中心加载性能承诺。owner audit分页序号after排他；最后页nextCursor=null；结果只含proposal/digest/revision引用，无正文。run.scope固定baseRevision/allowedExistingNodes/maxProposals(1..2)/maxApplications(0..1)/maxNewNodes(1..16)/maxNewEdges(0..128)。

错误沿统一{error:{code,message}}：400 schema/cursor/key非法；401无效token；403角色、scope、跨grant或无grant；404资源不存在；409 native_graph_tools_unavailable、当前租期/fence/revoked不符、goal变化、CAS/idempotency/quota冲突；413 HTTP/proposal字节超限；500未知故障。harness:'claude'当前明确409；不能假称已native挂载。所有runner重放先验证当前授权，即便原成功已改revision也能恢复同keyreceipt；新key不自动rebase。调用失败/ACK缺失不能假称未提交，沿相同key重试但仍可被撤销/过期拒绝；owner可读已持久receipt。

本片事实：独立注册模块真实HTTP/PG9条 + 旧O03/O05/G01直接消费者25条通过。尚无共享生产mount/client/SDK桥接/模型调用。参考命令/原始输出见本目录报告；review独立进行。
