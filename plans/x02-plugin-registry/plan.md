# X02 插件注册中心基础

状态：in-progress。创建/更新：2026-10-06。Owner：Mika / gpt-6-astra。父计划：[X01](../x01-plugin-management/plan.md) 的 X01-02/03；这是注册基础片段，不是完整插件生命周期。

## 目标与设计

中心持久保存作用域内的固定包版本声明、公开配置、显式能力授予和可追溯操作。Web/CLI 共用下面的 HTTP commands；本片段不下载 npm、不运行第三方、不把注册声明当包完整性验证或宿主加载成功。

方案采用单个 registry 模块与现有 PG command 幂等事务。替代方案“先实现 npm loader”会扩大副作用/隔离范围；“前端本地配置”会丢失中心权威。采用 `registerPluginRoutes(app,pool)` / `migratePlugins(pool)` 两个接线入口，共享 index/client/CLI/lock 仍由主 Execution Lead 单写。

- 注册：`POST /api/plugins` 固定 npm name、精确 semver、声明 SHA256、license、host API major=1、能力及公开配置 schema。workspace=personal，可绑定该 workspace 内 project；同 scope/package 仅一条安装记录。状态始终 `registered` / `runtimeStatus=unavailable`，无实际启用 API。
- 命令：`POST /api/plugins/:id/commands` 带 expectedRevision、reason、Idempotency-Key。支持 configure（全量替换）、set-grants、register-version、select-version。版本 descriptor 不可变，同 semver 不得换 digest。选版清空配置/授予，需要显式重新确认；旧 revision/config/grant 仍可追回，不声称完整运行回滚。
- 公开配置仅已声明 boolean、整数、枚举字段；禁止秘密字段/未知键，自由文本和服务端 secret references 留后续受控入口。manifest 声明能力不自动授予，grant 仅限已声明能力并继承 installation 精确 scope，不包含任意文件/网络/执行授权。
- 每次成功操作原子写 revision、operation audit、幂等响应及当前指针。CAS 冲突和无效输入没有部分写入；重报返回原受理结果。审计含 actor=owner、输入摘要、before/after revision，不复制配置原值。operation `succeeded` 仅指 registry 事务提交成功。
- GET list/inspect、versions、operations 按条数/UTF8响应字节有界。列表不返回配置。inspect 可指定固定 revision；操作可按 ID 查回；分页不是跨请求冻结快照。
- host API major 未知拒绝。HTTP owner hook 复用中心，runner 不能管理插件。重启只恢复 registry 事实，不启动代码。

## TODO 与验收

- [x] **X02-01** 小合同、拒绝语义、接线文档；由本提交回传主Lead/Web。
- [ ] **X02-02** 008 migration、不可变版本/revision/audit、registry commands。
- [ ] **X02-03** 独立临时PG/动态HTTP验证：身份/作用域、CAS/双事务、幂等、重启、配置/授予、版本不可变、分页字节上限。
- [ ] **X02-04** 固定实现SHA、原始检查/质量证据、独立review与修复。
- [ ] **X02-05** 主Lead接共享 client/CLI/index、受控集成；分支检查不等于main具备。

测试 seam 是真实中心 HTTP + 独立 PostgreSQL，合同拒绝测试通过同接口。数据库触发器不可变性允许直接 SQL 攻击验证，单独标注。0模型/0云，不触碰49922/55049/4320；不清理已有数据库。Node24 / pnpm9.15.4 / Vitest4.0.18；只测本模块及直接消费者。

## 架构影响与边界

新增 PG registry module、008表与 owner routes；不改变 Runner FSM/外部网络/执行容量。主Lead接线后由 D05 owner 更新固定架构基线，当前标 branch-only。真实 resolver、执行binding、可用性ACK、enable/disable/remove/完整rollback、第三方隔离、秘密入口、Web管理页与CLI接线是后继，不在本片段提前完成。
