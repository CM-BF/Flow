# ATTACH01 runtime handoff

唯一树 `attachment-resources` / `codex/attachment-resources`，base `f181d84b5fb3652d62e2a181acff442d42b3e066`。当前运行时固定target见[status](../../../plans/wpf-attach01-resources/status.md)与[runtime candidate](runtime-candidate.json)，独审见[review](../../../plans/wpf-attach01-resources/review.md)。phase1小合同独审批准6bc2918永久保留；后端运行域8701a6已于2026-10-06 10:49:15 UTC获root独立APPROVED，主线接收与公共接线另记。

入口：[Interface](interface.md)、[运行验证](runtime-validation.md)、[phase1验证历史](validation.md)、[质量](quality.md)、[运行检查与16源hash](runtime-checks.json)、[18scope原始amend](runtime-amend-receipt.json)。无浏览器截图；本片是中心资源/冻结输入/迁移及PG/HTTP直接消费者，Web输入接线另片。

独立复验（只写自己的临时输出目录；不改作者证据）：

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_ATTACH_EVIDENCE_DIR=/tmp/flow-attach-independent pnpm exec vitest run apps/server/src/attachments/attachments.test.ts apps/server/src/attachments/context.test.ts packages/contracts/src/attachments.test.ts apps/web/test/conversation-context-receipts.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsc --noEmit
```

测试创建随机 `flow_attach_*` 数据库、动态HTTP端口。默认使用本机55432既有测试PG，可通过`FLOW_ATTACH_TEST_ADMIN`提供不同隔离测试管理员连接；不输出连接凭据。只有`crash-center` case终止**自己fork的临时中心进程**，不碰任何既有服务。每个数据库的资源与cleanup记录写输出目录，remaining/connections/errors应为空/0；错误也记录，不强杀未知连接。

F01需接入的窄入口：`migrateAttachments(pool)`放在projects/context及既有migration之后；`registerAttachmentRoutes(app,pool)`放在已有owner auth hook下、listen之前。模块不会自行启动后台服务；GC是有界`cleanupExpiredAttachments(pool,projectId)`内部维护函数，上传首次发布也执行同项目expired-unbound清理。公共exports/client/server mount由共享owner实施，本分支未改这些文件。

CREATE回执始终稳定attachmentContext:false；项目固定的GET snapshot在026已装时提供true，project capabilities给出限额/namespace。只非空attachments进入template2；无附件/[]和原v1 key重放保持v1。新client→旧center纯文字省略attachments字段。旧loaded Web显示正文但不展示附件。合同含两类有序轻引用，执行编排知识先、附件后；公共metadata无正文，授权内容按需，runner只经既有private claim得到完整冻结prompt。

保留限制：首片仅UTF-8 `.txt`/`text/plain`，每文件/总材料8192bytes、总引用4；不支持runner文件/PDF/image。24h后禁止新引用，retained仅保旧执行/审计，不延长期限。已绑定材料不回收，全局command journal无GC；不声称全部DB存储有界。浏览器上传恢复/Send-Queue跨reload未知回执和真实App接线均后继；0provider/模型/个人中心操作。PG/HTTP为隔离实测，不代表已部署用户中心。
