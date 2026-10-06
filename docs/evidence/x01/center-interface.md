# X01 center material installation Interface

本片沿[已批准合同](center-installation-seam-request.md)，正式唯一DDL `029-plugin-material-installs.sql`，不依赖028。进度唯一源为[status](../../../plans/x01-plugin-management/status.md)。生产八文件独立交审；旧leaf及依赖已main2f16，源码未动。

- `migratePluginInstallations(pool)`：在 `migratePlugins`(008)、`migratePackageFetches`(023) 后调用；唯一正式029、现有flow-migrations锁/版本表，无fixture重复DDL。
- `registerPluginInstallationRoutes(app,pool,host)`：挂现有中心owner-auth之后；新增 `/api/plugins/:id/versions/:versionId/install`、`/api/plugin-installs/:id`、`/api/plugin-installs/:id/commands`、`/api/plugins/:id/material-installs`、`/api/plugin-installs/:id/history`。全部公有字段/分页见 contracts/src/plugin-installations.ts，4KiB输入、64KiB输出、默认20/max40。根createServer真实owner/runner鉴权已由本片手动register后的HTTP测到；默认生产挂载/客户端/CLI仍由F01接线。
- Host配置：`artifactStore:{root,storeId}` 必须同已受理X05源；`materialStore:{root,storeId,allowedDigests}` 为operator配置的canonical private root与明确self-owned SHA allowlist。目录由部署者事先准备，HTTP不收路径、receipt或信任声明。叶层仍复核root/private身份、压缩字节及完整有限展开流；center不import插件代码。
- start仅accepted且从未开始。`admitInstall`/`commandInstall`用原flow.commands保存稳定receipt；重放不进入runInstall。前台runInstall使用**一个**PG session try-lock保护逻辑store，不排队新worker；检查没有preparing/unknown后，preparing事务COMMIT ACK明确才读artifact/prepare。file work在事务外；结果只通过原持锁session提交。注册revision与确切成功fetch attempt/完整artifact输入冻结，029 FK与不可变输入约束防串属。
- 丢锁abort后仍await本次FS；不另连数据库完成原写入。preparing/unknown为持久store写入门禁，拿到新lock不能证明旧FS停止。reconcile只exact `readInstalledPackage`，并需trusted `executionSettled(executionId)`证明同一次旧执行的全部I/O已收束；**默认缺证据就是unknown**，不得由HTTP传true、时间/PID猜测或单靠完整receipt认定停止。本片fixture的证明来自已await结束的自有调用；没有通用跨进程恢复证明设施。
- HTTP断开/center preClose及host signal合作abort；所有own work由调用await收束，未引入hard-kill或伪硬截止。发布后取消、close/rename未知保持unknown。只读GET有no-store；installed仅静态材料，不是enabled/loaded/callable/隔离或完整任务绑定。

F01最小接线：导出公有DTO，薄client/CLI复用现HTTP；server按上述迁移顺序注册模块并提供host配置/关闭生命周期。共享index/client/CLI/main不在本owner范围，必须fresh claim协调。不得为让reconcile变绿提供恒true的生命周期证据。完整X01启用/grant/真实runner产物、disable新绑定、v2/v1pin、rollback、active/unknown refs、renderer/verifier/context/第三方隔离继续原TODO。
