# O04 原生目标工具接线：作者交付

固定实现 `1420dfa2f44117f49ec022665bcddc11739e36ae`；base `80e3c50e7a368c562a7730567503d8c82772b77a`。独立review尚未开始，工作分支证据不是main事实。0模型/0云/0原生SDK query。

新profile显式 `access: goal-tools`，必须空材料范围、无Read approval，独立runner发布后不可变。Owner只能通过goal-run受理取得持久grant；内部purpose由中心调用代码设置，普通submit/conversation和HTTP伪造purpose拒绝。专用runner仅领取绑定自身profile且有未撤销grant的任务；claim引用由DB派生。013只前进扩mode，012与旧grant不改。

运行链为现有 main → configuration/profile guard → runRunner → host-bound GoalToolPort → 原 Claude adapter。main无需新分支或新agent loop；manifest新增 `goalTools:true` 且 `allowRead:false, materialFiles:[]`。原有readonly/none行为保留。Runtime只把方法能力给adapter，runner token留宿主闭包；原env allowlist继续排除Flow/数据库凭据。

SDK MCP key/name均为 `flow-goal`，真实server列出 `goal_read`/`goal_command`；query options精确列出 `mcp__flow-goal__goal_read` 与 `mcp__flow-goal__goal_command`。PreToolUse要求来源sdk、相同key和精确名称；未知/plugin/dynamic/其他key/tool拒绝。tools=[]移除builtins。缺capability/不匹配profile在query前拒绝。Port省略input version明确拒绝，实际工具要求版本化引用。

作者组合 **77/77（18.96s）+ runtime直接消费者25/25（2.03s）+ tsc**，共102个不同测试。真实生产createServer挂载输入 b87a4bb，完整受控shared输入dc9；未改这些共享文件。原始：[77项](checks-final.txt)、[25项](checks-runtime-consumer.txt)、[tsc](typecheck-final.txt)。

- 真实PG+HTTP+runRunner+生产ClaudeAdapter的query注入接口，取该次实际SDK MCP instance，以官方MCP1.32.1 initialize/list/call调用。read/define/execute、重复key、范围拒绝、版本化input到中心真实事务。
- 故障注入在命令已提交的HTTP onSend处断开ACK：工具返回outcome_unknown，显式同key重放取得已提交结果，只记一次quota/audit；撤销后该cached key仍被中心拒绝。
- 最终result原文经原session/usage/artifact/verifier/assistant-final/outbox持久化；thinking不写正文。取消使迟到synthetic result无final/artifact。
- 8种hook provenance/tool组合、缺host capability、矛盾manifest均验证；普通profile消费者和O03授权race通过。

[wire.json](wire.json) 是官方MCP Client `tools/call` 请求/响应的实际保存记录（12410B），不是完整JSON-RPC传输抓包或模型输出。未记录凭据。客户端初始化/实际tools list及query options另由运行断言核对，不冒认原生子进程中的FQ工具解析已实测。23源码、20原始输出/回执的hash/bytes见 [manifest](manifest.json)。

复跑（现有Node24、PG55432；测试自建UUID数据库/动态端口，生产61228与dashboard4320未操作）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
FLOW_O04_EVIDENCE_FILE=/tmp/flow-o04-review-wire.json PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/runner/src/goal-tool-bridge apps/server/src/goal-tool-runs apps/runner/src/claude.test.ts apps/runner/src/configuration.test.ts apps/runner/src/execution-profiles.test.ts apps/server/src/execution-profiles/execution-profiles.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/runner/src/runner.test.ts --no-cache --configLoader runner
```

失败保留：red-native-admission为新profile未实现时400；red-sdk-mount为query尚无MCP工具；green-native-admission.txt实际是一次共享cherry-pick冲突导致装载失败，已abort并受控完整merge，其名称不表示成功，后续retry才通过。progress-bridge-http初次误用client不存在的方法；checks-bridge两失败是ordinary submit真实202的测试预期错误，以及跨runner重复synthetic session被中心正确拒绝。修测试真实输入/方法，未削弱归属或权限断言；其后final全绿。

边界：query函数被注入，未调用原生SDK子进程/模型/auth，未验证自然语言规划或真实语义；只两个受限Flow工具，无工程写权。O01 execute仍fixture，本trace只证明确实受理queued child；native final/自身artifact verified不等于goal或child最终交付。O02仍每读全snapshot/hash，不宣称token/中心性能提升。无native planner resume/C02自动重放；未知外部写仍须核对。

[设计/clean-code](design.md)、[唯一状态](../../../plans/o04-native-goal-bridge/status.md)。官方参考：[custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)、[permissions](https://code.claude.com/docs/en/agent-sdk/permissions)，实现依本机固定SDK0.3.290声明与实际官方peer。
