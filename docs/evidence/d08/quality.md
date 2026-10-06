# D08 skills and quality

2026-10-06 09:15:18 UTC：先find-skills领域匹配，优先实际读取本地技能，无安装。
- /Users/citrine/.agents/skills/find-skills/SKILL.md: SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`
- /Users/citrine/.agents/skills/codebase-design/SKILL.md: SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`
- /Users/citrine/.agents/skills/clean-code/SKILL.md: SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`
- /Users/citrine/.agents/skills/brainstorming/SKILL.md: SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`
- /Users/citrine/.agents/skills/webapp-testing/SKILL.md: SHA256 `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2`

应用：bounded设计已先只读核现有status/aggregate/card/document路径，root批准九scope、manager COMMITTED后才实施；用户授权/本地plans规则优先于skill通用额外审批/文档位置要求。codebase-design以一个关系Module封装重复检测、有限两层关系和错误；clean-code避免把registry/读取授权复制进前端，复用现drilldown。clean-code安装来源固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。每段/交付/长段安全点记录实际发现。

前置事实：原status字段表重复会报告错误但field对象last-wins；新关系解析需收原始行。app compactTask/openTask已有单一入口；documents只允许登记scope与被引用文件。MATURE大task已有显式层级/自ID，D01旧来源不可被本owner批改；无parent不必等于错误，也不推断旧记录为大task。
