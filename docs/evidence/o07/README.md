# O07：受限原生图工具接入证据

固定审查 target `c22412b5dd1368e3cdb14cd2c9afb6785b33a0e5`；生产实现 `9a64d92405fb1e0ccbc2d71f90e38a7a65ff44d1`，最后提交仅增加旧 node bridge 直接消费者测试。base `45b720eeb9aa41873b29ba3ce240578330b77e15`。Node v24.20.0 / pnpm 9.15.4 / Vitest 4.0.18 / Claude SDK 0.3.290 / MCP peer SDK 1.32.1。作者 assignment_review / gpt-6-astra；0 nativeQuery、0模型、0云调用。

受控输入：完整K02 `7368497ade6b80725e024d86541b87c971389476`（两claim seam已scoped批准，但当时整个K02尚未审）及已审main `3d4985fca060155435b159e0467815bf8e88b8b8`（O06 client/017生产挂载）。没有修改共享index/client/lock。O07测试独立库显式补018后才listen/claim；当前main尚不等于此组合。019只扩graph mode，与018无SQL依赖，但生产接收必须先完成017/018/019再启用claim和queue；该统一生产挂载由Lead负责。

## 实际行为

- 独立`goal-graph-tools` profile，空材料/无Read批准，与node `goal-tools`互斥；普通submit、conversation、旧node grant不能获得图写权。purpose仅内部参数，HTTP伪造字段拒绝。profile/runner/task/grant/attempt绑定。
- SDK实际server.name和注册key为`flow-graph`；官方MCP peer实际列出`graph_read`、`graph_command`。生产query options精确限制`mcp__flow-graph__graph_read`/`mcp__flow-graph__graph_command`；权限hook以合成SDK输入验证source=`sdk`、name、工具名和当前ownership。没有运行真实模型工具broker，不能据此称native语义已验。
- Host通过公共FlowClient封装固定grant/ownership，凭据不进入MCP参数/结果或SDK子进程env。node/graph复用host ownedCalls和同一SDK gate；复用原loop、outbox、heartbeat/cancel、typed final、artifact/verifier。
- 实际官方MCP→HTTP/PG链记录空项目三步骤：base1读空底稿、1proposal、3nodes/2edges、apply到revision6，同key重报成功，后续read仍base1且current6/stale=true。节点taskId均null，数据库只有该planner task，没有执行child。实际synthetic SDK `final.result`作为正文与已验证artifact持久化，thinking不进入正文。
- 在apply事务提交后断回包，MCP先明确outcome_unknown；同key恢复原receipt，撤销后同key仍拒绝。独立task cancel使迟到final/产物均0。撤销工具grant不等于取消planner task，这两种动作保持区别。
- 真实017旧fixture grant+audit升级019保留scope/quota/history，不可变/撤销规则不放松、重复迁移无副作用、新claude可受理。第一份[upgrade.json](upgrade.json)在合K02前确为017；[upgrade-with-context.json](upgrade-with-context.json)为018 claim schema已就绪的后续组合。另保留原014 node grant/audit历史升级直接消费者。

## 原始检查

67个不同通过检查，分三次局部执行，无重复计数：

| 实际执行 | 结果 | 原始输出 |
| --- | --- | --- |
| graph MCP4 + permission9 + injected SDK3 + HTTP/PG整链3 + native admission/claim3 | 22/22，7.34s | [final-native.txt](final-native.txt) |
| Claude26 + 旧node SDK10 + manifest6 + 两个真实迁移 | 44/44，5.61s | [direct-consumers.txt](direct-consumers.txt) |
| 共享host authority的旧node bridge实际HTTP/PG消费者 | 1/1，1.79s；其他3按明确filter未执行 | [node-bridge-consumer.txt](node-bridge-consumer.txt) |
| TypeScript | exit0，空stdout | [final-typecheck.txt](final-typecheck.txt) |

[wire-final.json](wire-final.json)保留11次真实工具协议请求/响应、请求UTF-8 JSON字节、响应编码字节及PG结果/清理事实。该合成小图响应范围100–873B；这不是LLM token测量、吞吐或延迟结论。`graph_read`20默认/50上限，只含base节点id/title/version；proposal全文按id另读。O02复用的结果保护限制完整编码MCP结果≤64KiB，超限明确isError，未静默截断；后端O06仍有whole-state读取，此片未优化中心存储。

保留红/中间失败：首MCP缺tools、native未实现409；测试误把TaskSummary/GoalDefinition当包装详情；两个fixture错误（TaskSnapshot字段、跨runner重复synthetic session）。全部仅修测试理解或相应实现，没有放松session隔离。见red/intermediate/first原始文件和manifest。R04 teardown可能记录aborted claim残余HTTP连接达到1s drain deadline；所有runRunner promise先结束再close，专库实际删除；不是新的shutdown修复。

## 复跑

在本worktree使用Node24，已有依赖，无模型认证或query启动：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_O07_WIRE_FILE=/tmp/o07-wire-rerun.json pnpm exec vitest run apps/runner/src/goal-graph-tools apps/server/src/goal-graph-runs/native.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_O07_UPGRADE_EVIDENCE=/tmp/o07-upgrade-rerun.json pnpm exec vitest run apps/server/src/goal-graph-runs/native-migration.test.ts apps/server/src/goal-graph-runs/migration.test.ts apps/runner/src/goal-tool-bridge/sdk.test.ts apps/runner/src/goal-tool-bridge/configuration.test.ts apps/runner/src/claude.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

每次测试创建随机专属DB及临时目录，动态端口，受控清理。第一条在最终源码含新增node消费者后是23项；作者既有原始22+单独1，不冒称重跑过23项组合。没有运行Web/browser、原生模型、独立runner OS子进程或外部工具；不证明自然语言规划质量。未来1query/4turns/$0.20/90s只是未授权候选，不挪用旧预算。

## Clean-code收尾

2026-10-06 05:58 UTC：读用既有本地find-skills/codebase-design/clean-code/tdd/brainstorming，沿本stack已记录来源，无安装或升级。检查命名/单责/接口/错误/重复：权限政策由两caller共享深接口；没有第二loop、第二授权状态机或duplicate tasks INSERT。旧node真实消费者补证共享helper的版本读、scope403和abort，修复其测试返回shape错误。源码冻结，剩余事项是独立review与依赖生产挂载；未作真实NL/child/新UI能力声明。
