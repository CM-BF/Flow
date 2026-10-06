# O08 固定准备片段

实现target `6b864881a3acb4957ad8482a7bffc71619f2c8d8`，固定产品输入main `a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8`；作者assignment_review / gpt-6-astra，2026-10-06 06:49 UTC。

本轮 **0 native query / 0 provider / 0真实认证**。默认SDK构造与MCP tools/list；确定性演练复用现runRunner/production adapter但query是注入，独立runner进程通过真实SDK MCP→公开FlowClient→HTTP/PostgreSQL运行，不是native broker或自然语言理解证明。[用法、未来许可格式、预算与限制](../../../experiments/native-graph-acceptance/README.md)。未生成可用native授权记录，未提供/读取真实token。

最终 **8个不同检查**：7个Node检查（授权/schema/默认预检/拒绝/重跑防护）+1个实际端到端演练。此前重跑/阶段结果另存，不累计为更多不同检查。

- [checks-delivery.txt](checks-delivery.txt)：7/7，473ms。native无许可入口拒绝前未创建output或私有PG资源；不会调用query。
- [rehearsal-fixed.txt](rehearsal-fixed.txt)、[rehearsal-fixed.json](rehearsal-fixed.json)：固定源码独立runner、1次注入query/0native，3节点2依赖，proposal/apply各1。中心总task1且节点taskId=null，typed final task/attempt/fence归属与verification通过。自有runner自然退出，无强杀；center/随机专库/tmp清理全true。
- [preflight-delivery.json](preflight-delivery.json)：实际pinnedSDK、源hash、真实MCP schemas与key `flow-graph`。模型effective字段未伪造；演练无init，保持null/unknown。
- [syntax-final.txt](syntax-final.txt)：7个mjs `node --check` exit0，stdout空。纯实验JS，无生产改动，未重跑整个产品测试或无关typecheck。
- [guard-red.txt](guard-red.txt)：原marker放permit同目录导致移动文件可重复消费，3/4、1fail；修成固定持久marker位置并绑定worktree/source后[guard-green.txt](guard-green.txt)4/4。最终[checks-delivery.txt](checks-delivery.txt)包含新增有效capability检查。
- `*-first`/`*-final`/`*-delivery`保存中间零query预检/演练；唯一固定验收为`rehearsal-fixed`与`checks-delivery`，不是多次真实模型调用。

固定演练观察：两个官方MCP工具，read空graph→propose→apply；中心audit真实runner/attempt/fence，final来自claude.sdk.result（合成注入）。只保存工具请求响应与typed final/usage事实，不保存thinking。模型预算报告null为未调用，不填成已花费0美元的provider证明。

清理范围是本driver创建的随机`flow_o08_...`数据库、动态端口、私有tmp和独立runner进程组。结果输出保留在本证据目录；其他服务/61228/4320未操作。新的原生运行须另获GO许可；即使准备或执行失败，也不能删marker/换output重试。

原生门槛尚未实际验证：1 SDK query/4turns/SDK估算$0.20、90s合作取消与父观察停止；未知/越界费用不通过。native startup/auth、SDK最终model/extension实际值、真实语义、native超时/SDK子进程强杀均未运行。本次只有代码与0query负面guard证据，不能声称native预算硬保证或OS硬实时期限。文件系统/清理可晚于90s，停机ACK≠停止；有残余/未知cleanup不当通过。

后继候选：若未来同一次GO新授权且固定产品基线已含CHAT05/CHAT06，可同时保留真实tool activity及partial/settlement事实；当前仅方案候选，不等待组合、不改本片段源码、不额外query。未做UI实观，不称live UI。

## Root P2最小修复（2026-10-06 07:00 UTC）

固定delta `decfcee90264f84ecf3c02874c1e6c85d65bfe13`，原实现与原始输出保留，原manifest另存[manifest-original.json](manifest-original.json)。原审查为CHANGES_REQUESTED，不冒认已经批准；Root独立复审待收。

[process-red.txt](process-red.txt)实际复现：leader exit0，而忽略TERM的孙进程仍在原PGID，旧stopWorker在0.05ms返回。新实现从不根据leader退出宣称组停止；负PGID signal0仅ESRCH证明组不存在，TERM等3s后KILL再确认最多1s，未知/权限失败拒绝。并发deadline/finally复用同一promise，防重复杀与不同结果。没有扩大生产代码或调用provider。

[process-consumers-final.txt](process-consumers-final.txt) **5/5**：3新增生命周期场景（真实3级进程树、自然已退出组、合成EPERM未知）+原2driver直接消费者；3.638s。真实孙进程清理约3.08s，KILL后PGID确认不存在；test finally也确认自有组消失。EPERM是观测失败注入，不是假造一次OS权限拒绝。先前[process-green.txt](process-green.txt)3绿是重复检查，不重复计数。

[rehearsal-p2.json](rehearsal-p2.json)/[stdout](rehearsal-p2.txt)在固定delta复跑同一0query演练：整组确认stopped、无强杀，自有center/DB/tmp均清理。此1演练与旧场景相同，不增加不同用例。结合未改guard的既有5项，累计**11个不同检查**（10Node+1演练），本次执行5Node+1演练；未重跑产品全库/类型检查。新[preflight-p2.json](preflight-p2.json)与[9个mjs语法检查](syntax-p2.json)通过，无native调用。

依据[Node24.20.0 detached官方说明](https://github.com/nodejs/node/blob/v24.20.0/doc/api/child_process.md#optionsdetached)和[process.kill官方说明](https://github.com/nodejs/node/blob/v24.20.0/doc/api/process.md#processkillpid-signal)，Unix detached进程是新组leader，子孙存活独立于leader。证明只限本次已知PGID；主动脱组/setsid未隔离或证明，1s确认失败即unknown，不声称全系统树停止或OS硬实时。未知会保留私有tmp且最终failed-or-unknown；中心cancel仍不等于停止。

[known-extensions.json](known-extensions.json)绑定BASE实际[历史会话证据](../f01/queue-live/turn-1.json)9991B/hash a18d7acaac7546b6e0c8f875025743ef05f5ef935710e0bb6a16aa6c8d468b9d：3managed plugins+3skills与零扩展gate不符，native未就绪。这里只核已保存字节，无新SDK startup/query/auth探测，不绕组织配置。真实运行仍沿GO既有预算流程，当前准备授权不变成执行许可。

07:01 UTC收到Root独立APPROVED decfcee90264f84ecf3c02874c1e6c85d65bfe13，现场clean39f5967；10source/32raw/6dependencies全部固定/current hash符合。P2 CLOSED，无P1/P2，Root核分批原始检查、未重跑或query；批准仅0query准备，native仍未就绪且无执行许可。原manifest/hash保留，本段只是独立结论转录。

07:08 UTC：GO另批准已知managed资源候选实施；新target7403b56与独立[managed证据](managed-baseline.md)/[managed-manifest](managed-manifest.json)待Root审查。原decf批准、原manifest与所有raw不变，新准备不生成query许可。
