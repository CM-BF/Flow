# O02 方法与质量记录

2026-10-06T04:16:00Z：Node24/TypeScript/Claude SDK MCP stack。find-skills 本地优先已读 /Users/citrine/.agents/skills/find-skills/SKILL.md；已有 codebase-design、clean-code、tdd 足够本 seam，无额外安装。实际读取同根各 SKILL.md；brainstorming 在同 stack 前段已读，授权方向已明确，普通实现不重复审批。clean-code 固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

应用：把 SDK 装配、分页/版本投影、错误映射留在单一模块；复用现有 host 权限，不复制中心事务。TDD 从真实 MCP seam 一个行为开始，PG 用公开 HTTP 观察。首段检查命名/权限/异常与不必要复杂度：避免造临时持久账本，避免默认全量历史；待实现后继续复核。0 模型、0 认证网络；只读官方说明与本地声明。

2026-10-06T04:18:00Z 段末 clean-code：实际检查 3 个生产文件与公开测试。装配/读投影/安全结果三项职责独立，所有权限仍走 createGoalTools；未引入持久缓存/重试账本；结果限额计算编码后的 MCP result，含字符串转义。未知异常不输出 message，已知 Flow 4xx 只输出状态；命令拒绝和 ACK 丢失分开。未发现需修改的生产问题。

验证演进：首 tracer 在模块尚不存在时 0 测试加载失败（red-bridge）；随后 1/1 green-first；扩展 read 后先 3/4 失败再 4/4 通过，原 stdout 保留。首次新 PG 测试行为 1/1 通过，但后续 typecheck 发现测试调用未显式提供 public client 类型的默认字段 workspaceId / taskId / parent；补齐后最终 typecheck 通过。这是测试代码类型修复，没有改变公共合同。最终 6 本模块行为 + 2 直接消费者 = 8/8，非整库。

真实 PG 测试使用 flow_o02_<UUID>，动态 HTTP 端口；两次中心重启和 fresh MCP server instance，无模型/runner/query，测试结束 DROP 自己 DB。未知 ACK 是端口在真实中心完成事务后有意抛错；不是 OS hard-kill。SDK 的 in-memory transport 发送真实 JSON-RPC，不能称为 TCP 吞吐测试。
