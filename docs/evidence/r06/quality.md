# R06 技能与工作段质量

2026-10-06 09:04:58 UTC，范围：Node24 TypeScript stdio transport/生命周期设计。

先依 find-skills 本地优先方法，实际读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`，以及 tdd 的 SKILL/tests/mocking、brainstorming。已有本地深模块/错误边界/行为测试方法满足此范围，无缺失专用技能，不装依赖或技能。clean-code 固定 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

应用：单一 transport 生命周期所有权，小组合端口，帧解码/写队列隐藏；测试仅公开 API→实际自有合成 Node stdio。已有授权与精确派工明确该 seam，按项目规则继续，不重新请求普通设计许可。先 tracer 行为 red/green 后补边界，不用模块缺失冒行为red。检查命名、错误清洗、无不必要框架、有限资源；首合同没有已执行检查。
