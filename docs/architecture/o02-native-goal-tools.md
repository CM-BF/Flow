# O02 原生 MCP 目标工具

Interface：createGoalToolsMcp(options: GoalToolOptions) 返回固定 SDK 的 McpSdkServerConfigWithInstance。调用者固定 goalId、allowedNodeIds、allowedCommands 和 port；bridge 不接收凭据，不调用 query。两个 MCP 工具 goal_read / goal_command；后者原样复用现有严格命令 schema 和 idempotencyKey，不生成或重写 key。

读取以 tagged request 选择 overview、goal、node、input 或 explanation。默认概览每页 5、上限 10 节点，仅名称、版本、状态/引用/数量；省略完整目标、输入、执行 prompt、依赖列表和历史正文。完整输入要求 nodeId+version 并复用原 handler 授权。概览/goal/node/解释保持现有“固定整个 goal 可见”语义，不虚称按节点读隔离。完整 node 不返回 task prompt；输入原文走 input ref。

快照引用是完整权威 GoalSnapshot 的 SHA-256；分页和按需 goal/node/explanation 要求该引用匹配当前快照，否则明确 stale_snapshot，需要重新读概览。input 版本独立且不可变。解释只可读取中心当前窗口（最多 50），不伪造无限历史可用性；返回窗口范围/省略事实。每个工具结果 UTF-8 JSON 上限 64 KiB，超限明确 response_too_large，不静默截断，不宣称 token 上界。工具命令结果只投影状态、id、版本和原解释，不盲返 task prompt。

固定版本：Claude Agent SDK 0.3.290，Zod 4.6.5，官方 MCP SDK 1.32.1（测试 peer，与 Claude SDK 同版本依赖）。实际协议版本待握手记录，不宣称 MCP 2026 全规范。官方说明已读取：https://code.claude.com/docs/en/agent-sdk/custom-tools 。实际固定包 sdk.d.ts 核实 tool/createSdkMcpServer/instance.connect；最新文档不替代固定版本证据。

失败：已知授权/参数错误为 isError；未知 port 异常只回安全错误码和“不明提交结果，同 key 核对”，不输出异常正文，不自动重发。只读 annotation true，命令 false；注解不是授权，host handler 仍检查。无模型/no query，不证明 SDK agent loop 已挂载或自然语言计划质量。
