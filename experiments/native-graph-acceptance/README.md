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

未来候选native入口是 `--execute --output <new-dir> --permit <GO-new-approval.json>`。**本轮没有可用许可，也没有运行该入口。** 需要Goal Owner新的明确单次许可及固定源码review，不挪任何旧预算。许可记录是可信operator转录人类授权，不是密码学签名或机器自动批准。不要仅为了让程序运行而自行生成许可。

将来经批准的记录必须具备：kind=`flow-o08-one-shot`，authorizedBy=`Goal Owner`，唯一approvalId（8–100字母数字/短横线），authorizationReference为此次人类批准消息的明确引用，sourceDigest/worktree精确复制已审preflight（worktree包括末尾斜线），model=`sonnet`，limits按顺序为`queries:1,maxTurns:4,maxBudgetUsd:0.2,timeoutMs:90000`，approvedAt/expiresAt为有效ISO且有效期不超过一天。该模型是请求alias，实际型号以SDK init记录为准；改变配置要重新批准。

两层一次性标记：固定本checkout `docs/evidence/o08/attempts/o08-attempt-<approvalId>.json`以`wx`受理并sync，在任何私有数据库/凭据/worker建立之前保留；worker在实际调用nativeQuery前再以`wx`保存`.query-started`并sync。移动permit/output目录不能复用，worktree也被绑定。即使准备失败、ACK/报告缺失，标记都不自动删除或重试；文件显示unknown是起点状态，最终事实看result。合作operator不能靠拷贝checkout/删除标记规避人类单次限制；这不是OS隔离或防恶意管理员的平台。

固定候选限额：最多 **1次SDK query调用**，SDK最多4turns、SDK估算$0.20；不等于1次底层模型HTTP请求或账单硬上限。adapter合作90s取消；父进程90s观察deadline会停止自有runner进程组，清理最多另等3s再SIGKILL。event-loop阻塞/OS停顿/文件系统等待不因此变成硬实时保证。没有实际native超时/强杀验收，本轮只验证了演练的自然收尾。

有效能力必须由实际init证明：permissionMode=dontAsk，恰好`mcp__flow-graph__graph_read`和`mcp__flow-graph__graph_command`，唯一MCP `flow-graph`且source=sdk/status=connected，无skills/plugins；缺省/未知不当通过。SDK实际版本、model、tools、extensions、session、final turns/估算费用均记录；禁止保存thinking原文。发生未知费用、越界或工具配置差异时失败收尾、不补次。最终图/audit/final须来自同runner/task/attempt/fence并忠实说明未执行child。

native将复用批准的本机provider环境；driver不读取或输出token内容，owner随机token仅父进程，runner随机token仅私有0600配置/host闭包，生产SDK环境过滤保护Flow/DB凭据。演练使用新空HOME，无继承provider凭据。所有异常只输出固定说明；失败会保留可读的task/graph/audit和worker报告。中心cancel ACK不当实际停止；cleanup另记等待自有PID退出的结果。私有库/tmp随后清理，成功演练/失败均保存result；若无法确认runner结束则保留其tmp，不把不完整cleanup当通过。

测试与复跑：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --import tsx --test \
  experiments/native-graph-acceptance/guard.test.mjs \
  experiments/native-graph-acceptance/driver.test.mjs
```

本文件、driver与guard的逻辑均是实验任务文件，不修改产品实现。真实NL/费用/原生broker及主生产部署仍未验，父O01/U11后继保持open。
