# CHAT 两轮真实模型验收（预算已条件批准，尚未调用）

这是普通对话验收，不是E01工程写改/公平性能实验，不消耗或扩展已封存R02 5/5。当前只准备配置、输入和检查；没有执行真实query。Goal Owner已批准下述预算：必须先CHAT三端独审接通、完整main固定、实际配置核对一致；达到条件才运行。

## 固定边界

- 待合入已审CHAT01/CHAT02/Web后，以完整main SHA冻结运行；Claude SDK保持0.3.290，native adapter实际版本必须含typed assistant-final。模型显式`claude-sonnet-5-5`，记录init实际resolved model，不因别名或不可用而自动换模型。
- 最多2个独立query、每query maxTurns=2、maxBudgetUsd=0.20、timeoutMs=60000；总调用上限2、SDK配置估算总额不超过$0.40、主动运行时限3分钟。SDK估算不是provider实际账单或项目预算引擎；发生一次失败/权限异常/未知usage即停止，不自动重试或开第三次query。
- 只使用已有合法本机Claude登录，通过原生SDK正常读取；不读/打印/复制token、不刷新wrapper借用凭据。若native认证不可用，保存脱敏错误并停止。
- `materialFiles:[]`, `allowRead:false`, `requireReadApproval:false`。固定adapter实际传`tools:[]`, `allowedTools:[]`, disallowedTools:['*'], mcpServers:{}, strictMcpConfig:true, permissionMode:dontAsk, settingSources:[], plugins:[], skills:[], thinking:disabled。没有用户文件、shell、网络工具或工程写改能力。
- 专用随机后缀PostgreSQL数据库、动态center/Web端口、`/tmp/flow-chat-live-<random>/`下runner目录与0600 manifest；不使用任何用户项目作cwd，不修改或停止49922/4320/他人服务。SDK会写自己的临时会话材料，不能称零文件写入。

## 可执行启动配置

已存在production入口：center `apps/server/src/main.ts`，runner `apps/runner/src/main.ts`读取`FLOW_CLAUDE_MATERIALS_FILE`，该manifest支持下列字段；实际启动前再以固定source检查工具配置和预算参数没有漂移：

```json
{"materialFiles":[],"allowRead":false,"requireReadApproval":false,"model":"claude-sonnet-5-5","maxTurns":2,"maxBudgetUsd":0.20,"timeoutMs":60000}
```

只有隔离数据库中的测试conversation允许提交。通过公开owner HTTP注册Claude runner、用临时runner token启动单个runner，用户Web连接此隔离中心。CLI/client创建与查询使用相同公开接口，无直接数据库修改业务状态。任何配置不符停止；不把fixture代换为真实模型通过。

## 两轮旅程与停止条件

1. 启动时生成随机16字节hex nonce，仅作为合成记忆素材。Web新conversation发送：“请在本次对话记住标记 `<nonce>`，现在只回复‘已记住’，不要复述标记。”保存用户turn/task/attempt绑定、SDK session与effective配置、typed final来源。第一轮必须实际assistant正文出现；execution telemetry另列；无工具调用。第一轮任何usage/cost缺失、非成功result、正文缺失/未知归属，均停止，不运行第二轮。
2. 只关闭本次Playwright启动的专用隔离浏览器进程，再以新隔离浏览器进入同一conversation；不得关闭Codex IAB、用户4320/49922或其他标签。若只能关闭独立测试tab，必须明确记录页面重开与观察连接终止，不冒称完整浏览器进程关闭。随后；发送：“刚才要求你记住的标记是什么？只回复该标记。”第二轮请求不附nonce，只凭同一native session resume。要求稳定conversationId、有序新turn/新task但原native session；回复精确包含nonce（可仅去除首尾空白），来源指向第二task/attempt，不混第一轮或telemetry。
3. 查看两轮消息重连后无丢失/重复，详情在显式点击前不加载。记录requested与effective、实际query次数、SDK modelUsage/cache/cost原始值与unknown，不把UI按需加载等同LLM token节省，不声称partial streaming/queue/steer已验证。

任一失败保留事实和脱敏证据，立即停止测试runner；取消ACK不等于客观停止，等待进程退出并记录pid/exit。结束只清理本次测试进程与专用DB；保留审查所需脱敏结果/hash，临时凭据文件删除。用户常驻预览服务维持原状。

## 预算与验收输出

逐query记录SDK声明估算值与session累计语义。resume累计可能重复纳入历史，不把两个累计值直接说成本增量；预算停止可采用更保守的求和上界，同时保存原始来源。第二次之前第一次估算值必须known且<=0.20，实际总量若未知不宣称通过。SDK限额是尽力限制，不承诺provider超限概率为零；出现超过阈值即halt，不继续尝试。

输出固定main/SDK/model、0工具证明、两turn/task/attempt/session映射、浏览器关闭/重开与正文截图、lazy detail计数、每queryusage/预算检查和进程清理。没有真实工程写改、100agent容量、语义goal编排或公平harness对照结论。Goal Owner已条件批准最多2次/$0.40估算配置；三端独审与固定main/实际配置未就绪前仍禁止实际调用。
