# 已授权有界设计

11:36:23Z 实际开工；采用本地 find-skills→brainstorming bounded路径，上一只读方案已由Mika明确采纳，不重复索许可。codebase-design 将引用观察集中为 readPluginRemovalReferences 一处；clean-code 保留唯一状态权威和保守 unknown，不复制卸载/执行FSM。技能为 /Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code}/SKILL.md；本次复用已装基线、不安装，实际内容SHA见skills.json。

GET /api/plugins/:id/removal-references?materialInstallOperationId=UUID&cursor=opaque。复用现 owner hook、READ ONLY REPEATABLE READ 事务/no-store；strict query不接受limit/paths。检查材料确属该登记并已installed；允许查询旧版本材料，不以当前选中版本误拒历史。输出只身份/有限状态原因，不输出标题、input、configuration、token。

每页按034现(registration_id,created_at,id)索引键扫描最多40+sentinel，先截40再过滤已确认的精确storeId/materialId（同材料不同安装operation别名仍保留，引用返回自身operationId）；raw cursor推进最后扫描键，空refs也可能有next。游标绑定登记/材料/currentRevision与原始键，revision变化409。每页独立快照，task状态可能跨页变化，新绑定在旧键之前不承诺被旧遍历捕获；必须重读，禁止作删除授权，无跨页一致总数/无COUNT。64KiB响应上限；SQL keyset形状不等EXPLAIN性能已证。

状态 active=queued/running/waiting/cancel_requested；uncertain=task uncertain、终态仍有未完成attempt或身份/状态异常；historical仅观察终态无openattempt，不证明宿主释放。hostRelease固定unknown、purpose=reference-observation、physicalRemoval=not-authorized。没有removeAllowed真值。取消/连接断开结束当前read观察，后继分页由consumer自行决定，不后台扫全。现有pg query/statement timeout沿原pool，失败不返回部分结果。

复用现PluginDatabaseFixture、createServer和公开register/enable/admit构建PG准备；synthetic installed材料仅测试真实SQL引用，非npm执行。实际PG未OPEN。模块入口新增，不改client/Web/migration/材料字节。

覆盖范围仅所选registration的tool-task bindings；同一物理材料在其他登记下的引用不在本页范围，不能从空页推导全store可回收。
