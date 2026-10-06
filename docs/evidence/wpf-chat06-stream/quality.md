# 技能与质量

2026-10-06 07:10 UTC：按find-skills识别TypeScript增量状态模块/assistant-ui消息适配，复用已安装本地技能，无重新安装。

- find-skills: /Users/citrine/.agents/skills/find-skills/SKILL.md，SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`。
- codebase-design: /Users/citrine/.agents/skills/codebase-design/SKILL.md，SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`。
- clean-code: /Users/citrine/.agents/skills/clean-code/SKILL.md，SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。
- assistant-ui: /Users/citrine/.agents/skills/assistant-ui/SKILL.md，SHA256 `20bd24ab58c8d281b329e1df34655c8a6dc0cd56d8a087aff252b37025c6937c`。
- brainstorming: /Users/citrine/.agents/skills/brainstorming/SKILL.md，SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`。

应用：codebase-design保持两个bound readers的小interface与纯累计器；clean-code将wire验证/状态生命周期/消息表现分开，测试从公开seam。assistant-ui读本地architecture及实际core0.3.22 ThreadMessageLike/MessageStatus，公开llms索引 https://www.assistant-ui.com/llms.txt 已核；使用已有react0.15.23/core0.3.22，不基于新版猜API。用户授权/root派工和正式receipt已明确bounded方案，不重复brainstorming审批。clean-code安装固定sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；约30分钟安全点和交付复核。

已识别风险：meta可能落后新patch，attempt分页中可能变化；不能用callback闭包跨连接复活；prefixDigest为UTF8正文；canonical final可能truncated或先到，不能只凭finalMessageId删draft。这些作为直接行为测试，不增加第二pipeline/公共协议。

2026-10-06 07:19 UTC 工作段复核：保持wire验证/累计器、请求生命周期、纯消息三个职责；以当前metadata确认身份但允许同block的sourceMessageId随事件改变，metadata-before-new-block仅有界补读。新增3个真实红测暴露same-revision完整性及final竞态，已修复；页内错误不发布部分新状态，已有可信正文保留。原日志保留，见[验证](validation.md)。

2026-10-06 07:26 UTC 交付前clean-code：读取五个实现/专测文件，检查命名/错误处理/重复/预算和行为。单flight与lifetime在同一模块，不增事件总线、poll或无用hook；稳定scope/两reader是唯一外部接口。发现合法前缀后的历史缺口会错误清空失败计数，补红测后仅完整flight成功才清零。root实际installed core的小探针确认无status的final会跟随global running；本模块显式complete/unknown并补测试，不改任务状态或发送门禁。metadata提前报告interrupted亦保留。54直接检查+Web类型检查通过，来源绑定固定3ac11，不重复无关工程套件。

未解决但属后继明确范围：App可见状态标记、host opt-in/生命周期预算、真实provider/HTTP/浏览器与性能验收。当前不以模块状态metadata冒称已完成可视化；独立review仍由root执行，作者清码不替代独审。
