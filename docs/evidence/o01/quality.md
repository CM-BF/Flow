# O01 技能与质量

2026-10-06 03:07 UTC，Astra。Node24/TypeScript/PostgreSQL，复用本 task stack 的本地优先 discovery；实际重新读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`brainstorming/SKILL.md`、`tdd/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`。本地技能已匹配，无新增安装。clean-code 固定用户来源 sickn33/agentic-awesome-skills @ bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；不反复安装。

实际应用：brainstorming 先写已授权可审设计，比较全局 revision 失效与实际 input/dependency binding，选择后者；codebase-design 采用中心 HTTP + 纯受限工具两个公开 seams，存储细节不泄漏给工具；TDD 从真实 HTTP/PG 行为红测开始；clean-code 关注原子命令、窄 schema、明确 unknown/恢复错误、避免另造工作流及复制 G01。

初始发现：G01 node.version 同时包含标题/依赖/绑定变化，不适合作为实际输入版本；独立 node input version 可避免无关项目 revision 全局失效。G01 taskId 单一绑定不适合多次执行，因此 goal executions 独立引用 G01 node 与现有 task，保留全部历史。共享入口由 Lead 单写。

SDK：根锁已固定 @anthropic-ai/claude-agent-sdk 0.3.290，实际 tool/createSdkMcpServer 类型待安装后核验；此段只纯 handler，无 SDK/模型调用。交付前继续记录实际检查、发现、修复与未解决。
