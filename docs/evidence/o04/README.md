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

## 既有012授权升级补证（Root独审要求）

2026-10-06T05:05:09Z，test-only固定 `a169a2e139e5db5e7bc2fd6f55699014a41e9926`，产品实现仍为 `1420dfa2f44117f49ec022665bcddc11739e36ae`。Root已核原23源码/20输出与102检查；尚待本补证复核，不预写APPROVED。原源码和输出hash均未变化。

新增单场景先在随机专属DB从空库顺序运行实际前置迁移至011，再执行仓库原012 SQL及版本记录；没有创建013后倒退。012模式约束实测只含fixture，版本表实际为1至12。通过现生产domain接口创建fixture grant、claim与一次define-input审计call；这段是既有012真实schema的数据准备，不声称启动旧版本中心进程。随后实际调用生产 `migrateGoalToolRuns` 升至013并重复调用，核旧版本时间、完整grant/scope/used_commands和完整call数据不变；再启动生产 `createServer` 重复迁移，以公开HTTP验证同一旧grant、原key结果重放、唯一命令额度仍拒绝新key、撤销后缓存key也拒绝。PG触发器仍阻止扩大scope、更改mode、回减额度、删除call或清除已撤销状态。新显式goal-tools profile的claude grant返回201/queued；没有启动runner或query。

新增 **1/1，2.02s**；类型检查通过。首次运行即通过，没有人为制造SQL错误或声称修复过产品缺陷。未重跑原102项。原始stdout：[场景](checks-migration-upgrade.txt)、[类型检查](typecheck-migration-upgrade.txt)；真实前后行/版本/HTTP状态与DB删除确认：[原始JSON](migration-upgrade.json)，SHA256 `d04ff10e2e4450e6e49e4a0acad1bb24d54c21c841ebad30deeac3d72e10715a`。不含runner token，专属DB已删除，现有服务未动。

复跑：
```sh
FLOW_O04_MIGRATION_EVIDENCE="$PWD/docs/evidence/o04/migration-upgrade.json" PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/server/src/goal-tool-runs/migration.test.ts --no-cache --configLoader runner
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```
复跑会使用新的随机专属DB；独立review需另设临时输出路径，不覆盖本原始JSON。
