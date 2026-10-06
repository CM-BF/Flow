# K02 方法与质量

2026-10-06 05:40 UTC：Node/TypeScript/PG stack按find-skills本地优先复用本会话已读 /Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code,tdd}/SKILL.md。设计/测试seam已Goal Owner批准，无重复approval。clean-code仍sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，未重装；PG方法沿K01已核supabase/agent-skills c9be0e931b7930f7d02126d04774d904c381e7d7 skill1.1.1，约束/复合关系/参数化查询，不照搬性能倍数。

实际应用：单一context模块隐藏冻结/编译/digest/详情/private projection，两个不可变authority职责清晰；复用K01 PoolClient reader与现command事务/receipt，不新增broker/runnerendpoint/知识协议。预算按真实字符串和UTF8，公开metadata与private文本分开。保持conversation→task、runner→task锁序，claim不反锁project/conversation。先红后最小实现，再直接消费者组合；原副作用矩阵用唯一DB/动态端口/正常清理，metadata不重测。

2026-10-06 05:46:02 UTC：首段clean-code复核：canonical稳定序列化避免JSONB键序导致重编译差异；contextDigest不包含currentVersionAtFreeze，而executionPrompt包含该必要快照并独立digest。claim在既有runner/task事务只读input，核rawPrompt一致/完整context与input摘要/预算，不改submission；失败回滚attempt写。首3用例通过且资源清理明确；尚不批准queue/retry完整能力。check后续增加实际未跟踪测试/helper hash，早期原证据不补写不存在的采样事实。

2026-10-06 05:55:50 UTC：领域交付前clean-code/codebase-design复核。冻结编译、metadata投影、任务绑定与retry重编译均在context模块；queue自动/显式路径共用既有promoteItem，不复制gate。K01批量读取保持一SQL所有refs同snapshot；queue新metadata读取改一次有界batch，避免新N+1。SQL公开字段allowlist避免未来新增私有属性泄漏。task/turn/queue绑定不可清空、原文和输入不可变且FK存在；坏digest/raw/compiled触发回滚，包括真实session reservation。现23模块测试与noEmit，无未解决领域实现项；旧consumer和生产mount仍未验，不作批准。原JSONB序问题及所有red保留，不填补早期采样缺口。
