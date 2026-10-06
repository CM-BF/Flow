# O06 设计与质量记录

2026-10-06 开工：Node24/TypeScript/Fastify/PostgreSQL，同 stack discovery 复用且实际重读本地 find-skills、codebase-design、clean-code、tdd、brainstorming（/Users/citrine/.agents/skills/*/SKILL.md）。已有匹配，无需安装。clean-code 来源 sickn33/agentic-awesome-skills 固定 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。已获 Root/Lead 明确方案、范围和 HTTP/PG seam 授权，不重复技能确认。

选择共用私有授权深 module（两真实 caller），而非复制状态机或迁移旧 grant 表到泛型权限平台。固定 adapter 隐藏表查询，事务/锁序/fence/当前授权统一；revocation 共用单调规则，旧错误码保持。中心 graph-only fixture，native 409。

scope 固定 baseRevision/允许引用现有节点版本、最多2 proposals/1 application/16新node/128边；maxApplications=0 可只建议。原始goal digest/project绑定由中心写进不可变grant scope。graph read 固定不可变base，默认20/上限50 id/title/version，cursor绑定run/project/base，显式stale。图正文与proposal按需读取，不混最新内容。

成功apply后的同key：先当前auth，再幂等读取，CAS只在新mutation内检查；receipt恢复不被自身产生的revision阻挡。旧grant不能读用graph routes，graph仅apply自身proposal+digest。actor从授权run/current task/attempt/runner/fence派生，不能HTTP指定。017加表并扩actor列，旧owner行不修改；旧域默认owner保持兼容。

测试采用真实公开HTTP+专属随机DB/动态端口，数据库仅故障注入/持锁控制用于证明事务race；0query/模型/云。公共SDK桥接和真实自然语言留下一独立任务，不把本中心模块视为完整能力。

2026-10-06 05:35 UTC clean-code交付复核（实现f6ba02e）：检查命名、接口、事务/锁顺序、错误、重复与真实行为证据。把O03授权与revoke集中于私有authority，两固定store adapter无用户SQL；把O05 create/apply业务抽为同TX helper，未复制G01 mutation。scope/CAS/幂等职责分别明确，legacy owner actor不添加新字段。017复用不可变trigger；actor在原text列编码有约束JSON，避免旧owner路径依赖新列，旧历史未重写；真实actor不可HTTP输入。函数适度保留SQL与事务邻近，未为行数再造泛型框架。已修扩展测试领域类型推断，34行为及tsc通过。无已知阻断；保留shared mount/native bridge与后台全state加载的范围限制。metadata不重跑检查。

交付metadata检查：15 source与13 raw outputs对固定target/hash/bytes一致，本地相对链接0缺失。git diff --check仅原始stdout末尾空行提示，按证据原样保留，不美化改写日志。05:34 UTC实际dashboard O06 live/clean/issues=[]，范围未变。
