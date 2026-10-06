# D08 skills and quality

2026-10-06 09:15:18 UTC：先find-skills领域匹配，优先实际读取本地技能，无安装。
- /Users/citrine/.agents/skills/find-skills/SKILL.md: SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`
- /Users/citrine/.agents/skills/codebase-design/SKILL.md: SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`
- /Users/citrine/.agents/skills/clean-code/SKILL.md: SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`
- /Users/citrine/.agents/skills/brainstorming/SKILL.md: SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`
- /Users/citrine/.agents/skills/webapp-testing/SKILL.md: SHA256 `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2`

应用：bounded设计已先只读核现有status/aggregate/card/document路径，root批准九scope、manager COMMITTED后才实施；用户授权/本地plans规则优先于skill通用额外审批/文档位置要求。codebase-design以一个关系Module封装重复检测、有限两层关系和错误；clean-code避免把registry/读取授权复制进前端，复用现drilldown。clean-code安装来源固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。每段/交付/长段安全点记录实际发现。

前置事实：原status字段表重复会报告错误但field对象last-wins；新关系解析需收原始行。app compactTask/openTask已有单一入口；documents只允许登记scope与被引用文件。MATURE大task已有显式层级/自ID，D01旧来源不可被本owner批改；无parent不必等于错误，也不推断旧记录为大task。

2026-10-06 09:22 UTC 段落/交付前 clean-code：核五生产文件和两专测。关系解析独立、原始字段保留重复信息，resolver只查一层登记父；不从 co-lead 字符串分割斜杠，不复制进度/授权。按root边界补纯路径匹配，ID指错计划不得导航；自引用不例外。未知注册父仍可安全查看但页面明说“关系未知”。co-lead超长返回独立unknown对象，避免旧value残留。未发现需新抽象或拆分框架的问题。

实际检查：45直接检查覆盖14新关系行为与既有31消费者检查；5组独立临时Git/HTTP浏览器，键盘/同modal父跳转回焦点、转义、未知/陈旧、双主题390，无pageerror。首轮直接测试仅一处作者预期错误：原资料端点拒绝路径为404而不是测试写的403，产品接口不改，first-direct.log保留。首browser启动因未下载Playwright bundled Chromium失败，改用机器已有Chrome，未安装浏览器；browser-launch-failure.log保留。浏览器第二次只调整全页截图的固定头重复采样为视口截图，并补launch失败清理；未改变产品。首浏览器报告保留来源，但截图以最终报告为准。

真实来源仅只读五个登记源：MATURE02/04 owner已经修显式大task，未硬编码；D01旧记录无层级保持unknown。该抽查不等于4320部署。根manifest/lock、registry/server/documents、他人status未修改。无真实模型、产品DB或旧服务操作。

2026-10-06 09:26 UTC review证据纠正：此前只把fullPage切成viewport仍不足，owner/Root图像均见底部旧页头。实际DOM1/rect静态，resize即时capture复现、两animation frame后消失；补每theme独立390context稳定截图与JSON，保留旧图/原来源并明确早期视觉结论过早。无产品或已冻测试源码修改，不重跑无关45；后续截图流程应在resize/theme后等布局绘制稳定。

2026-10-06 09:26:59 UTC后，root独立APPROVED eca59a5（base77c）：独立45/45、完整七源码和hash/scope审读；CUA同modal父导航/资料/Escape与深色，实际看verified390浅深。独审无blocking；旧截图采样问题已作为证据纠正，产品保持冻结。作者5组browser与root局部CUA/独立45准确分开。交付metadata不重复工程测试，main/部署仍待Lead。
