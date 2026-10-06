# B03 技能与质量

2026-10-06 04:57:17 UTC：find-skills本地优先，读取 /Users/citrine/.agents/skills/find-skills/SKILL.md、brainstorming/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md、tdd/SKILL.md。clean-code来源sickn33固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重装。Bounded设计/HTTP+store seam已获派工批准，不重复approval。应用：明确preview类型避免假完整内容；共同参考映射保身份；真实PG先红后绿；仅ownDB动态port。复用已装node_modules，@flow映射本WT，不改lock。

PG16官方依据：https://www.postgresql.org/docs/16/functions-binarystring.html 与 https://www.postgresql.org/docs/16/functions-string.html；保留convert_to UTF8，不用content::bytea；PG仍全量hash。
