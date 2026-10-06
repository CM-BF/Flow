# O12 技能与质量

2026-10-06 11:54 UTC；TypeScript/Node24 + PostgreSQL + headless controller。按find-skills方法本地优先，实际读取 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,brainstorming,tdd}/SKILL.md。已有匹配技能充分，未安装/联网发现。clean-code固定用户sickn33来源bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

应用：深模块隐藏读预算/intent恢复，以现FlowClient、ObservationReads和中心权威复用；不复制conversation状态机。用户/Lead已批准scope与公开测试seam，brainstorming设计记录后直接实施；先公开失败再最小实现。clean-code启动检查命名/单责/生命周期/错误/界限，未决为ACK校验与store失败测试，不以抽象宣称性能收益。

2026-10-06 12:03 UTC — 本段clean-code复核：commands隐藏固定intent/ACK身份，reads只解码边界，controller单一会话生命周期；query复用既有FlowClient/ObservationReads，未复制mutation/授权/调度。公开4旅程先2绿2红：持久保存ACK失败需保留本地intent、detail实际合同无taskId（归属来自已观察binding），均修正后4绿。生命周期先5绿1红发现dispose早于读settle，补等待自身pending；相关plan变化的late state再现1红后修复generation失效。历史2红→2绿。最终13新+7原O11共20/20、noEmit0。controller最初骨架早于首旅程，保留真实失败而非编造完整先红顺序。

未解决/范围：IntentStore的持久介质/单namespace独占由宿主；命令64KiB，最多200计划节点/50状态/50历史ref/一个正文，两active四queued；没有自动轮询、native dispatch或NL解释。解释text按现有生成记录单条读，固定版本不可当当前有效。artifact只允许当前已观察binding，已展开正文可保留；完整历史artifact导航不是本片。取消不等停止，未知不等失败。类型/读取身份检查不复刻中心有效性判定。
