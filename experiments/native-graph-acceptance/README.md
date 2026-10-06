# O08：原生图规划验收准备

这是已授权的 **0模型准备**，不是实际调用许可。默认命令不调用query/startup/auth，不读取真实凭据，只有固定SDK构造与官方MCP进程内`tools/list`、schema和固定源码检查。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx experiments/native-graph-acceptance/driver.mjs
```

固定产品输入main `a26a5f34577d3fdfeee81ef8c0e7d5658617d2b8`，Claude SDK0.3.290、MCP SDK1.32.1，均使用本仓库已有依赖，不借全局包。生产apps/packages/根manifest/lock若偏离固定输入，preflight拒绝，须重新审查配置。输出含本实验源码摘要、产品依赖hash和真实SDK tool schema/FQ。

零query演练：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx experiments/native-graph-acceptance/driver.mjs \
  --rehearse --output /tmp/flow-o08-my-new-rehearsal
```

每次必须新输出目录（已有result拒绝覆盖）。本机55432测试PG角色需要创建/删除随机`flow_o08_...`库的权限；仅自己的动态center端口、tmp和独立runner进程组。复用生产createServer、FlowClient、profile、runRunner、Claude adapter、outbox、verifier；query transport注入确定性结果，不启动原生SDK broker。真正的SDK MCP→HTTP→PG链保存三节点/两依赖、propose/apply各一次、typed final。只有一个planner task，所有节点taskId=null。合成prompt固定中文三步，只证明连线与验收器，**不证明模型理解或自主规划**。

未来候选native入口是 `--execute --output <new-dir> --permit <GO-new-approval.json>`。**本轮没有可用许可，也没有运行该入口。** 依照GO既有预算流程取得本次单次授权记录及固定源码review，不挪任何旧预算。许可记录是可信operator转录人类授权，不是密码学签名或机器自动批准。不要仅为了让程序运行而自行生成许可。

将来经批准的记录必须具备：kind=`flow-o08-one-shot`，authorizedBy=`Goal Owner`，唯一approvalId（8–100字母数字/短横线），authorizationReference为此次人类批准消息的明确引用，sourceDigest/worktree精确复制已审preflight（worktree包括末尾斜线），model=`sonnet`，limits按顺序为`queries:1,maxTurns:4,maxBudgetUsd:0.2,timeoutMs:90000`，approvedAt/expiresAt为有效ISO且有效期不超过一天。该模型是请求alias，实际型号以SDK init记录为准；改变配置要重新批准。

两层一次性标记：固定本checkout `docs/evidence/o08/attempts/o08-attempt-<approvalId>.json`以`wx`受理并sync，在任何私有数据库/凭据/worker建立之前保留；worker在实际调用nativeQuery前再以`wx`保存`.query-started`并sync。移动permit/output目录不能复用，worktree也被绑定。即使准备失败、ACK/报告缺失，标记都不自动删除或重试；文件显示unknown是起点状态，最终事实看result。合作operator不能靠拷贝checkout/删除标记规避人类单次限制；这不是OS隔离或防恶意管理员的平台。

固定候选限额：最多 **1次SDK query调用**，SDK最多4turns、SDK估算$0.20；不等于1次底层模型HTTP请求或账单硬上限。adapter合作90s取消；父进程90s观察deadline会停止自有runner进程组，整组最多另等3s再SIGKILL，并另用1s核查PGID不存在。event-loop阻塞/OS停顿/文件系统等待不因此变成硬实时保证。没有实际native超时/强杀验收；本轮已用零模型Node24进程树验证leader先退出而孙进程忽略TERM的整组强杀。

有效能力必须由实际init证明：permissionMode=dontAsk，恰好`mcp__flow-graph__graph_read`和`mcp__flow-graph__graph_command`，唯一MCP `flow-graph`且source=sdk/status=connected，无skills/plugins；缺省/未知不当通过。SDK实际版本、model、tools、extensions、session、final turns/估算费用均记录；禁止保存thinking原文。发生未知费用、越界或工具配置差异时失败收尾、不补次。最终图/audit/final须来自同runner/task/attempt/fence并忠实说明未执行child。

native将复用批准的本机provider环境；driver不读取或输出token内容，owner随机token仅父进程，runner随机token仅私有0600配置/host闭包，生产SDK环境过滤保护Flow/DB凭据。演练使用新空HOME，无继承provider凭据。所有异常只输出固定说明；失败会保留可读的task/graph/audit和worker报告。中心cancel ACK不当实际停止；cleanup独立核查本次detached进程组不存在；leader退出不算组停止。私有库/tmp随后清理，成功演练/失败均保存result；若无法确认runner结束则保留其tmp，不把不完整cleanup当通过。

测试与复跑：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx --test \
  experiments/native-graph-acceptance/guard.test.mjs \
  experiments/native-graph-acceptance/driver.test.mjs \
  experiments/native-graph-acceptance/process.test.mjs
```

本文件、driver与guard的逻辑均是实验任务文件，不修改产品实现。真实NL/费用/原生broker及主生产部署仍未验，父O01/U11后继保持open。

Root P2修复：观察deadline与finally共享同一个停止promise；只向本次detached worker的负PGID发信号。signal 0仅ESRCH确认组已不存在，权限错误/未知/强杀后仍存在均拒绝，结果保持failed-or-unknown并保留私有tmp。此证明限定未脱离该进程组的进程；主动setsid/重分组的进程未隔离或枚举，不声称OS沙箱或全宿主进程树保证。

**原生未就绪**：固定BASE已有真实历史[SDK会话记录](../../docs/evidence/f01/queue-live/turn-1.json)，resources列出3个managed plugins（cc-plugin-agents-md、cc-plugin-telemetry、cc-plugin-plugin-authoring）及3个skills（design、doctor、plugin-authoring）。它与本driver的零扩展gate不匹配；这是历史已知配置事实，不是当前环境再次探测。不能用注入演练或默认零query预检宣称native配置已可运行，也不能仅为探测而开新query或绕过组织配置。解除条件沿GO既有配置/预算流程另定，当前仍0provider。
