# O02 原生目标工具桥接

状态：completed；创建/更新：2026-10-06。Owner：assignment_review / gpt-6-astra。父目标：U11 / O01；本任务仅工程片段，不替代自然语言目标验收。

固定 Claude Agent SDK 0.3.290 的 tool/createSdkMcpServer，把现有 createGoalTools/GoalToolPort 接到进程内 MCP。保持目标与节点授权在 host 固定，命令幂等由中心持久实现；不造 agent loop，不调用 query、认证或模型。

- [x] O02-01 核验 claim/版本，冻结小接口及有界读取策略。
- [x] O02-02 实现 SDK 工具与安全错误、轻读和可追溯完整输入。
- [x] O02-03 真实 MCP + 隔离 PG/HTTP 验证作用域、幂等、拒绝和实际字节。
- [x] O02-04 clean-code、证据、独立 review 交接。

验收从真实 MCP initialize/tools/list/tools/call 进入；持久幂等从真实中心 HTTP/PG 观察。受限 port 的异常不把凭据带到工具回复。概览不返回完整输入/全部解释历史；显式引用与省略说明，旧引用不能冒认当前快照。SDK query 挂载、自然语言推理、模型 token 计费、生产运行配置留给后继。

独占范围见 [status](status.md)。设计见 [接口](../../docs/architecture/o02-native-goal-tools.md)，方法记录见 [quality](../../docs/evidence/o02/quality.md)。共享 manifest/lock 由 Lead 提供固定提交，owner 不写共享文件。

本工程片段已实现并完成作者检查，独立 review 尚未开始，main 尚未接收。SDK query 挂载/自然语言语义仍属父目标未完成范围。
