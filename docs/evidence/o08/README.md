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
