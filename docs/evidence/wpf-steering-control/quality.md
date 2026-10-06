# Skills and clean-code

2026-10-06 08:46:54 UTC：按find-skills方法发现React/typed公共port/异步回执/测试域，优先已装本地技能并实际读取，无安装。
- /Users/citrine/.agents/skills/find-skills/SKILL.md SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`
- /Users/citrine/.agents/skills/codebase-design/SKILL.md SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`
- /Users/citrine/.agents/skills/clean-code/SKILL.md SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`
- /Users/citrine/.agents/skills/assistant-ui/SKILL.md SHA256 `20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c`
- /Users/citrine/.agents/skills/webapp-testing/SKILL.md SHA256 `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2`

应用：codebase-design把状态校验/冻结/页刷新封在小control Interface；clean-code按每段命名/职责/错误/重复/复杂度复核；UI只render/trigger，公共FlowClient为HTTPfixture与未来host共同接缝。clean-code固定安装sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重新安装。SDK按现有锁，无默认steer adapter/新harness类型。读取新树AGENTS/plans规则/D04说明，先live字段核身份8scope再写。

启动发现：TaskSummary没有attempt，admission没有nativeSessionId，不能伪造预绑定；server owner/profile检查早于saved ACK replay，unknown重试4xx不能洗白；state.revision不包含receipt变化，refresh不能只读tail。上述纳入实际回归。
