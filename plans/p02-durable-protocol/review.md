# P02 独立review

状态：**CHANGES_REQUESTED（两项P2已修复，待复审）**。当前review target commit：**f942e5a5cbf138993dd7521792dd071a172c17e1**。生产入口旧target：e2955d4bc33c458b6dbdd10f380f834557ba98fa。Base：72278b22ae81f551dc13d68da2fb45f2ef182038。

Worktree /Users/citrine/Projects/AgentHarness/Flow-worktrees/protocol-dispatch；branch codex/protocol-dispatch。Lead共享9db3ce入口已pick为05a1308；本target包含实际入口检查，不再依靠手工注册备用逻辑。

只读核验固定target/head/dirty及规则；检查持久intent、ownership/lease、一次发送许可、ACK丢失及超时窗口、重启GET与过期不复活、实际取消、artifact版本/verifier、官方peer+PG+独立runner证据。关键目录apps/server/src/protocol-dispatch、apps/runner/src/protocol-dispatch、contracts protocol-dispatch/protocol-task、migration005；共享入口server/index、runner/main、CLI/index也属被测target。

已执行：作者typecheck；公开HTTP中心3项、独立runner进程10项，联合13/13（17.85s）。其中1项真实server/main从空schema启动、真实CLI注册/提交/查询、真实runner/main出站/产物/验证，SIGTERM exit0；其他9项专用入口支持短租约故障注入。中心命令ACK无限挂起回归先红后绿，12项历史证据保留。见[report](../../docs/evidence/p02/report.md)、[最终原始JSON](../../docs/evidence/p02/production-checks.json)、[源码hash](../../docs/evidence/p02/production-manifest.json)。

未执行：独立review、真实模型、公网对端、完整A2A/MCP conformance、MCP持久elicitation/Tasks、通用全程预算。取消夹具通过官方SDK handler subclass返回尚在working的Task，属于防御性故障场景，不宣称该对端行为证明完整规范兼容。

## 可复制审查任务

核验上述固定target和证据hash，使用find-skills及本地相关codebase-design/clean-code/TDD。默认只读，不改owner status。可按report复跑P02相关13项，专用flow_p02且无他人使用时才清其schema；动态端口，0模型0云，不覆盖原始证据。重点区分取消ACK/实际停止与发送ACK丢失/盲重试，检查lease期限不被持续心跳隐藏的ACK悬挂吞掉。报告severity/blocking、已执行/未执行/限制和必要修复，结论绑定target。

## Findings及作者修复

- P2 / blocking（Goal Owner源码检查、Lead确认派修）：mkdir位于lease构造后且try/finally外，目录失败可能留下timer并持续续租。真实chmod0500权限故障复现进程不退出；f942e5a把本地目录创建移至lease构造之前，失败明确EventStorageError。
- P2 / blocking（同上）：普通object继承ref与坏URL初始化错误可能在state/command尚无值时被吞，循环恢复续租。constructor/toString/坏URL实际复现；f942e5a使用null-prototype映射、Object.hasOwn及现有remoteUrl验证，配置错误fatal且在lease之前。

修复后5项实际main故障均exit1、0heartbeat、0remote send；受影响runtime15/15（20.64s）+typecheck，包含原生产入口smoke。不重复未改中心3项；13项基线原始证据保留。[当前JSON](../../docs/evidence/p02/initialization-checks.json)、[当前源码hash](../../docs/evidence/p02/initialization-manifest.json)。

结论：作者修复完成，独立复审尚未执行，无APPROVED。请复审f942e5a，不能沿用旧target作为批准。
