# 技能与质量

2026-10-06 06:05 UTC，Astra Ultra，按find-skills方法本地优先实际读取：/Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,webapp-testing,brainstorming,vercel-react-best-practices,assistant-ui,ai-elements}/SKILL.md。任务为已批准有界模块，设计已在只读阶段提交root/manager并获明确派工，不重复索要用户批准；计划按项目三件套规则。

应用：codebase-design隐藏cursor/缓存/代际复杂度于小interface；clean-code逐段错误路径与可测试interface审读；React稳定external-store snapshot、条件数据加载与分页DOM；webapp-testing在隔离动态HTTPfixture通过真实FlowClient验证计数/焦点/窄屏。既有官方Button用于交互，保留assistant-ui Thread主权，不复制新chat、不为无typed工具数据引AI Elements Tool。skills无安装/依赖更改。clean-code来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，文件SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317。

开工实查：旧events无signal，detail有；因此generation迟到抑制与HTTP取消必须区分。旧ActionBar隐藏running不适合集成入口，留唯一Thread后继。MAX_DETAIL_BYTES=1048576，不采用CHAT05 65536。无无关技能安装，无真实模型/DB。
