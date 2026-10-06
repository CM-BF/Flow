# 技能与质量

2026-10-06 07:45 UTC 启动。按find-skills本地优先方法复查React/知识选择/可访问性/测试领域；已读 /Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code,vercel-react-best-practices,webapp-testing}/SKILL.md。已有匹配技能，不安装；brainstorming采用root/manager已批准窄方案，不重复审批。clean-code固定来源https://github.com/sickn33/agentic-awesome-skills @ bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重复安装。

应用：controller隐藏生命周期/缓存复杂度，selection纯预算与immutable引用；React使用useSyncExternalStore读取稳定快照，原生控件与CSS tokens、不造Dialog；既有TypeScript Playwright HTTP fixture方法优先于引入第二测试栈。命名/单一职责/错误/重复/预算段落与交付复查。启动未写代码/未跑产品tests，无虚构通过。

UI方法参考root已读https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md 与https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ 。本模块不新建modal，不将正文放入live区。模型按派发gpt-6-astra ultra符合门槛。

2026-10-06 07:51 UTC 首段clean-code：selection纯引用身份/预算；controller独占bounded请求/cache，UI原生控件不持有网络；16实际模块tests与typecheck通过（未提交实现），HTTPfixture测试进行。发现freeze不能套全部readiness，否则关闭picker无法供后继Send；已分离读取门禁和本地冻结身份/授权/cap门禁并有hidden/offline用例。发现嵌套details toggle可能误触父读取，限定event target；dispose明确拒绝freeze。getSnapshot稳定/不可变、no-op readiness不publish、取消后late不写均已测。现真实FlowClient采用本树workspace client/contracts，frozen-lockfile ignore-scripts安装3.3s且根lock/manifest无改。无模型/产品DB。

2026-10-06 07:51:56 UTC 交候选clean-code：七源码固定34cd2b8。16tests/tsc/9HTTP浏览器最终复验通过、作者目视浅深390图；native details仅自身toggle触读、已处置controller拒freeze、关闭面板可freeze三行为修正已覆盖。body观察标签不宣称永久最新，whole-source digest不冒充chunk验证；不把hasMore当页游标。无新依赖/隐藏poll/URL知识存储/自动正文预取，无未解决实现finding（独立审查尚未开始）。生产只有4文件，测试以窄ports和真实HTTP client分别验证，未复制Send/Queue实现。
