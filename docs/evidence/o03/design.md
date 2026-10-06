# O03 中心授权设计与技能记录

2026-10-06T04:30:23Z；Node24/TS/PG 同 stack，复用已实际读取 /Users/citrine/.agents/skills/find-skills、codebase-design、clean-code、tdd 的 SKILL.md。clean-code固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。本地匹配充分，不重装；Interface以公开HTTP为测试seam，深module隐藏事务/授权，复用O01 mutation，不造scheduler/RBAC框架。

公共模块 registerGoalToolRunRoutes(app,pool,boss) 与 migrateGoalToolRuns(pool)，后续由Lead挂载。Native受理一律409 until显式profile新seam；fixture仅0模型事务测试。DTO固定readScope whole-goal，allowedNodeIds/allowedCommands/maxCommands；grant v1不可变，owner revoke后不再允许runner调用。planner task只能本模块同事务新建，不允许绑定已有task或resume。

共享helper：commandInTransaction(client,operation,key,input,run)复用既有命令锁/缓存/insert；applyGoalCommand(client,boss,goalId,input)复用O01状态与版本校验。Lead单写。新授权先在同TX完成，再进入同TX helper，cache hit也重新授权。

锁序：lockRunner→只读定位 grant→loadState(goal,true)取得project锁→ownedAttempt取得planner task/attempt→grant行锁→命令幂等锁→已有goal apply。与O01 project→child task保持一致；planner task永远不是它授权的child task，不能经任意taskId伪造该区别。owner revoke只拿grant锁，不等待task/project；取消只拿task，不等待grant/project，避免反序等待。所有live判断用PG clock_timestamp，不借浏览器时钟延长租约。

Audit只持久成功准入的命令identity/result refs和revocation事实；未知/拒绝由HTTP状态给出，不把未认证尝试写无限日志。命令额度只计不同已准入key，no-op仍是一次准入，replay不再扣；hash/key冲突拒绝。只读snapshot仍是O01既有有界200节点/50解释，O02模型回复缩减不等于中心性能改造。

2026-10-06T04:37:42Z clean-code交付复核：实际重读固定本地技能并检查4个生产模块、契约、迁移和公开HTTP测试。路由/持久grant/准入/工具调用各自职责明确；复用Lead提供的 commandInTransaction/applyGoalCommand，未复制goal mutation。重点核错误为明确HttpError、replay也授权、scope不可变、额度与audit同TX、planner与child task分离。初次类型检查发现server不应直接依赖zod类型，已从contract导出具体call types；测试key默认值显式string。初次扩展测试错误地假设队列立即可claim，修为公共claimReady明确等待，生产逻辑未为测试改动。最终9/9+tsc通过，无本片段未解决blocking。

边界：read是整个固定goal，不是逐节点读隔离；node allowlist用于input detail/commands。只在准入锁全部取得后核验有效租约；已经准入的命令可以先于撤销/取消完成，不宣称撤销回滚既有事实。拒绝尝试不写无限audit；成功命令上限32，owner audit分页最多50。原生profile/query/O02 runtime桥接、自动拆图/NL、共享生产挂载未在本片段实现。
