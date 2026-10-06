# 技能与质量

2026-10-06 07:10 UTC：按find-skills识别TypeScript增量状态模块/assistant-ui消息适配，复用已安装本地技能，无重新安装。

- find-skills: /Users/citrine/.agents/skills/find-skills/SKILL.md，SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`。
- codebase-design: /Users/citrine/.agents/skills/codebase-design/SKILL.md，SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`。
- clean-code: /Users/citrine/.agents/skills/clean-code/SKILL.md，SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。
- assistant-ui: /Users/citrine/.agents/skills/assistant-ui/SKILL.md，SHA256 `20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c`。
- brainstorming: /Users/citrine/.agents/skills/brainstorming/SKILL.md，SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`。

应用：codebase-design保持两个bound readers的小interface与纯累计器；clean-code将wire验证/状态生命周期/消息表现分开，测试从公开seam。assistant-ui读本地architecture及实际core0.3.22 ThreadMessageLike/MessageStatus，公开llms索引 https://www.assistant-ui.com/llms.txt 已核；使用已有react0.15.23/core0.3.22，不基于新版猜API。用户授权/root派工和正式receipt已明确bounded方案，不重复brainstorming审批。clean-code安装固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；约30分钟安全点和交付复核。

已识别风险：meta可能落后新patch，attempt分页中可能变化；不能用callback闭包跨连接复活；prefixDigest为UTF8正文；canonical final可能truncated或先到，不能只凭finalMessageId删draft。这些作为直接行为测试，不增加第二pipeline/公共协议。
