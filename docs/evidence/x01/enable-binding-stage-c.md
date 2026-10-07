# X01 Stage C：原两组 PG/HTTP 验收的资源准备

产品仍固定 `ade4efa0a332f4f1f1cbcd50012ab8881f41a8dc`。本增量只改两份测试的资源建立/收尾，新增共用 fixture 与显式 Vitest config；原 10 runtime + 11 registry 行为用例未增加、删改或运行。A 的真实包 17/17、B 的九入口 types0 是各自历史结果，不覆盖本次 fixture。

`enable-binding-pg-fixture.ts` 是这两份测试的资源 Module，不是生产迁移或第二监督器。其 `create()/finish()` 隐藏同一组 PostgreSQL 身份规则：

- 调用方传 `FLOW_X01_PG_WINDOW`（32 个小写 hex）、`FLOW_X01_PG_HEAD`（外层已核的 40 hex execution commit）和 `FLOW_X01_PG_ROOT`（已登记、canonical 的自有目录）。suite 各自排他创建 `runtime` / `registry` 子目录，记录 inode。每份收据绑定 window/source/suite/database；缺 env/目录异常则零 CREATE。
- `reservation.json` → 确认随机数据库名不存在 → `create-request.json` fsync → CREATE → 明确 ACK → OID/owner → 随机数据库 COMMENT 标记 → 再核 OID/owner/marker → `created.json` fsync。CREATE/COMMENT/收据任何不明，均不凭名称删库。COMMENT 是本次测试归属标记，不复制任何产品 DDL。
- 原真实 createServer/动态端口、runtime 手动路由与可信 policy、独立 PgBoss send client 保持。开服任一阶段失败即 startup 未确认，不把未返回的 app 当已释放。两 suite 先独立尝试关闭各自 app/boss，再结束 pool；只有持久创建身份、当前同 OID/owner/marker、所有 owner/pool 已结束、远端 0 连接齐备才普通 DROP。
- DROP ACK/absence/admin close 分开记录；失败不 FORCE、不 terminate 连接、不重试。每 suite 一份 `result.json` 保留有限错误类别及真实资源事实；外部 owner 未核终态前不清目录。单收据 ≤16 KiB，最多保存 16 条错误摘要并保总计数，不记录 URL、token 或任意错误正文。

显式 config 只含这两文件，单 worker/串行文件，cacheDir 必须指 own TMP。已有 30 份官方 SQL 与唯一 `034-plugin-runtime.sql` 由真实 migration 路径读取，没有第二套 schema。合成 terminal material DB 元数据仍只证明领域绑定，不证明 npm 下载、真实生产 runner 或 semver bundle。

后继在 heavy 槽授予后消费现 OPS14 `supervise(Launch,Policy)`，不新增 supervision/kill 循环。一次明确 Node24/Vitest4 argv 为 `node node_modules/vitest/vitest.mjs run --config docs/evidence/x01/enable-binding-pg-vitest.config.mjs --configLoader native --reporter=json apps/server/src/plugin-runtime/runtime.test.ts apps/server/src/plugins/plugins.test.ts`。在原 source/dependency 视图下重新绑定两个 test、fixture/config 和正式 SQL，fresh claim/head/余量与无输出，预约 own root/cache/window 后运行；时间/原始输出/TMP/配对预算由下一实际 bounded 段明确，不以本页自授数值或 OPEN。

实际成功必须同时是 21 selected/pass、0 skip、进程 final absent/完整 EOF/输出未截断、两个 reservation/request/created/result 的 window/suite/database/OID/marker 一致、所有 close/0 connection/DROP/absence 成立。未知不推断为空库或已清理；外层保留已知 path/dev/ino，不额外扫旧根。原断言失败仍保留失败，即使资源已安全收尾也不能称通过。

当前 `SOURCE_PREPARATION / VALIDATION_NOT_RUN`。没有导入、types、collect、PG、HTTP、浏览器或 provider 执行；生产挂载、v3 claim/恢复 guard、runRunner 和完整 X01 验收仍开放。
