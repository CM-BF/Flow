# O03 中心授权设计与技能记录

2026-10-06T04:30:23Z；Node24/TS/PG 同 stack，复用已实际读取 /Users/citrine/.agents/skills/find-skills、codebase-design、clean-code、tdd 的 SKILL.md。clean-code固定 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。本地匹配充分，不重装；Interface以公开HTTP为测试seam，深module隐藏事务/授权，复用O01 mutation，不造scheduler/RBAC框架。

公共模块 registerGoalToolRunRoutes(app,pool,boss) 与 migrateGoalToolRuns(pool)，后续由Lead挂载。Native受理一律409 until显式profile新seam；fixture仅0模型事务测试。DTO固定readScope whole-goal，allowedNodeIds/allowedCommands/maxCommands；grant v1不可变，owner revoke后不再允许runner调用。planner task只能本模块同事务新建，不允许绑定已有task或resume。

共享helper：commandInTransaction(client,operation,key,input,run)复用既有命令锁/缓存/insert；applyGoalCommand(client,boss,goalId,input)复用O01状态与版本校验。Lead单写。新授权先在同TX完成，再进入同TX helper，cache hit也重新授权。

锁序：只读定位 grant→lockRunner→loadState(goal,true)取得project锁→ownedAttempt取得planner task/attempt→grant行锁→命令幂等锁→已有goal apply。与O01 project→child task保持一致；planner task永远不是它授权的child task，不能经任意taskId伪造该区别。owner revoke只拿grant锁，不等待task/project；取消只拿task，不等待grant/project，避免反序等待。所有live判断用PG clock_timestamp，不借浏览器时钟延长租约。

Audit只持久成功准入的命令identity/result refs和revocation事实；未知/拒绝由HTTP状态给出，不把未认证尝试写无限日志。命令额度只计不同已准入key，no-op仍是一次准入，replay不再扣；hash/key冲突拒绝。只读snapshot仍是O01既有有界200节点/50解释，O02模型回复缩减不等于中心性能改造。
