# O05 设计与质量

2026-10-06T05:09:38Z，复用本任务stack既有find-skills发现：实际读用本地 /Users/citrine/.agents/skills/{find-skills,codebase-design,clean-code,tdd,brainstorming}/SKILL.md；Node24/TS/PG，已有方法匹配，不重装。clean-code来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。Root/Lead已批准有界设计及真实HTTP/PG seam，不重复普通授权。

提案为不可变owner提交的候选，source=owner-submission只证明接收方身份，不宣称文字由人独立创作；apply actor=owner由鉴权入口决定，不接收可伪造actor字段。未来runner生成/代理apply需新的独立授权与真实来源，不复用该owner标签。

输入含expectedProjectRevision/reason/additions，local key映射只在最终receipt产生真实node IDs。服务器从goal导出projectId/原始goal digest。首片仅新节点及其依赖，禁止旧节点变更、task绑定/执行。proposal创建时用G01纯图规则验证，应用时project锁内重新验证CAS、goal digest和引用。applyProjectCommand是原G01 callback小型提取，同TX先add所有节点后set-dependencies，多个revision同一事务提交，失败全部回滚；receipt记from/to revision与mapping。项目锁先于proposal锁，随后command幂等锁，避免与G01写入反序。

已应用proposal不因新key重复生成节点；结果为已保存receipt，原proposalDigest/baseRevision仍须与请求匹配。普通ownerapply不可伪造新正文。列表仅摘要及游标，正文按id展开；不截断超限正文。独立PG动态端口，生命周期清理自有资源。
