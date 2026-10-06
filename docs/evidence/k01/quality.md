# K01 技能与质量记录

2026-10-06 05:15 UTC：Node/TypeScript/PostgreSQL stack。按 find-skills 方法优先重用本地 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd}/SKILL.md；brainstorming 已于只读设计应用并获 Goal Owner 批准，不重复approval。clean-code 来源 sickn33/agentic-awesome-skills 固定 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，未重装。

PG补充由 Root 先 skills.sh 再 npx skills find 发现官方 supabase/agent-skills，worker 已读固定 c9be0e931b7930f7d02126d04774d904c381e7d7，skill1.1.1：[SKILL.md](https://raw.githubusercontent.com/supabase/agent-skills/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices/SKILL.md) 与同目录 references/advanced-full-text-search.md、query-composite-indexes.md、schema-constraints.md、security-privileges.md。不安装 Supabase、不采用泛化倍数/LIKE无索引推论。

实际应用：deep knowledge 模块隐藏版本/chunk/锁/检索细节；迁移复用全局 advisory migration 锁/版本记录，关系约束及project前缀复合索引，FTS生成列；既有owner preHandler + runner403真实鉴权，不造ACL。project→source锁保护跨来源容量，commandInTransaction复用命令回执。测试已授权HTTP seam，先红绿后并发/恢复。原文/短excerpt/完整chunk DTO分开命名。未有行为测试，不将stub当通过。
