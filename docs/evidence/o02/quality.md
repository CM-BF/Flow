# O02 方法与质量记录

2026-10-06T04:16:00Z：Node24/TypeScript/Claude SDK MCP stack。find-skills 本地优先已读 /Users/citrine/.agents/skills/find-skills/SKILL.md；已有 codebase-design、clean-code、tdd 足够本 seam，无额外安装。实际读取同根各 SKILL.md；brainstorming 在同 stack 前段已读，授权方向已明确，普通实现不重复审批。clean-code 固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

应用：把 SDK 装配、分页/版本投影、错误映射留在单一模块；复用现有 host 权限，不复制中心事务。TDD 从真实 MCP seam 一个行为开始，PG 用公开 HTTP 观察。首段检查命名/权限/异常与不必要复杂度：避免造临时持久账本，避免默认全量历史；待实现后继续复核。0 模型、0 认证网络；只读官方说明与本地声明。
