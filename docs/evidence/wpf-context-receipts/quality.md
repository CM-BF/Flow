# CONTEXT02 技能与质量

2026-10-06 08:13:51 UTC 启动：本人已按 find-skills 本地优先方法发现 TypeScript 接收协议/纯模块相关方法。读取本树 AGENTS.md、plans/AGENTS.md、plans/README.md；模型派发 gpt-6-astra / ultra。

- /Users/citrine/.agents/skills/find-skills/SKILL.md：本地已有合适方法，无需联网安装。
- /Users/citrine/.agents/skills/codebase-design/SKILL.md：将引用规则集中到小的纯函数 interface，调用者/测试走同一 seam。
- /Users/citrine/.agents/skills/clean-code/SKILL.md：固定 sickn33/agentic-awesome-skills 来源 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；每段检查错误语义、命名、重复及非必要抽象。
- /Users/citrine/.agents/skills/brainstorming/SKILL.md：沿已批准八范围设计，不重开设计审批。

启动 clean-code：现 outbox/Queue 只顶层冻结；public schema parse 会复制，因此必须在 parse 后重新深冻结引用。共享 tuple guard 不应复制为两个略异实现。当前尚未写实现/未跑测试；后续实际发现和结果追加。
