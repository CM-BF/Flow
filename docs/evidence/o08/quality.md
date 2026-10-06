# O08 方法与质量

2026-10-06 06:39 UTC，gpt-6-astra / assignment_review。find-skills本地优先，同Node/PG/SDK stack复用实际读过的 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md。clean-code固定sickn33来源bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重装。任务是已批准现O07链的有界验收准备；brainstorming确认窄设计/限制后实施，不为普通方案重复索取许可。真实query未授权，不执行。

已读生产claude.ts/runtime.ts/profile/policy/graph MCP与合同、O07 native/integration测试；只复用现runRunner与adapter，不构造新agent loop。guard与隔离生命周期是本实验Interface，单测其拒绝行为及0query真MCP→HTTP→PG行为。交付前检查命名/异常清理/不记录credential/分清native broker与注入。
