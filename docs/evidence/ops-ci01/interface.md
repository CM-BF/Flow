# OPS-CI01 Interface

状态：候选，未启用、未远程运行。唯一父任务 OPS-001。

此片仅修订 docs/ci 两个文档。用户最终确认后才能另行将已审 workflow 放入 .github/workflows；当前不授权 OAuth 扩权或远程调用。

最小 job 使用 GitHub-hosted Ubuntu 24.04、Node 24.20.0、pnpm 9.15.4、锁内 Vitest 4.0.18 和临时 PostgreSQL 16.13。只读 contents 权限、手动触发，无用户 secrets、模型调用、持久 cache 或 artifact 上传。安装仅未来的临时 runner，当前本机禁止安装。

执行 Interface 为两个明确选择：packages/contracts/src/contracts.test.ts 的 2 项，以及 apps/server/src/server.test.ts 中 persists accepted commands across restart and rejects changed retries 的 1 项，另 9 项未选。后者是真实 PostgreSQL + Fastify.inject 公开 HTTP handler，非 socket HTTP、runner 或 UI 端到端。任一非零退出、零选择、计数不符或 cleanup 未知都不能标成功。

数据库必须使用 FLOW_TEST_DATABASE_URL 与 127.0.0.1:55432/flow_c01，沿原 fixture 的 host/port/name guard。生产 createServer 的迁移/动态 SQL 与关闭路径保持，不复制领域 fixture。临时服务、测试停止与 normal cleanup 事实分列；job 平台销毁不冒充应用正常清理。

当前只静态验证 YAML、命令语法、精确选择、依赖与 SQL 存在性、权限/资源边界。Linux 候选不能替代 macOS/native/UI 验收，远程事实始终 NOT_RUN。
