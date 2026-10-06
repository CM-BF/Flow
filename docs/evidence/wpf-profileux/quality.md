# 技能与clean-code

2026-10-06 05:11 UTC；React19/Tailwind/CSS/Playwright局部UI。按find-skills本地优先方法，本轮读find-skills、frontend-design、clean-code、webapp-testing、brainstorming、vercel-react-best-practices；路径均为 `/Users/citrine/.agents/skills/<name>/SKILL.md`。另读ai-elements/references/model-selector.md。已有适用本地技能，无需安装。clean-code固定来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，沿用受控基线。Brainstorming为已批准bounded调整，不重复索取设计批准；项目三件套要求优先于技能不写plan的通用建议。

应用：frontend-design强调减少非必要层级，既有字体与主题tokens保持，不加装饰卡片。原生details管理展开状态，无新增store/effect/request。React指南采用简单派生展示不加memo；clean-code复核展示与创建领域分离。model-selector基于cmdk不适合这次锁定摘要，不引新依赖。webapp-testing采用既有TS Playwright+Vite受控fixture（复用项目工具），检查实际DOM/焦点/网络计数/截图并在结束清理，旧服务不动。

启动停点：已读FrozenConfiguration的常驻dl与窄屏单列样式；问题是展示密度，不调整目录/权限/冻结数据。实现后逐段及交付再记录实际发现、修复与未验范围。
