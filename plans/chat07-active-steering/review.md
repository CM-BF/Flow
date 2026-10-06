# CHAT07 独立审查

状态：NOT_STARTED

- Review target commit：21371153c6d83c67c3a3d7d0051c915c55f7b60b。
- Base commit：07b7e5bdbd8c9f68e8e7de7e13a03d60f948999a。
- Scope：024、持久命令/有界lazy正文、真实fence收据、事务seal。排除旧final主线/runner/SDK/Web。
- 关键验收：当前授权先于重放；一在途并发/CAS；received不冒消费或遵从；unknown不重投；两顺序seal竞争与同TX回滚；首次迁移/旧数据/重启审计/清理。
- 作者检查：16/16真实PG/HTTP + tsc exit0；原始输出/manifest见docs/evidence/chat07，不构成独立approval。
- reviewer默认只读，先核target/dirty与原始证据，findings交唯一owner。0query，不重跑全库。
