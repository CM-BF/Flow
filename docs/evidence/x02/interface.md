# X02 registry 合同（首片段）

源：`packages/contracts/src/plugins.ts`。主Lead单写共享exports/client/CLI；Mika单写本文件与registry。所有路由放在既有center owner鉴权hook后。

| HTTP | 输入/输出 |
| --- | --- |
| POST /api/plugins | PluginRegistration + Idempotency-Key → 201 PluginMutationResult |
| POST /api/plugins/:id/commands | PluginCommand + Idempotency-Key → PluginMutationResult |
| GET /api/plugins | workspaceId=personal, projectId（省略仅workspace级）, after?, limit=1..40 → PluginList |
| GET /api/plugins/:id | revision? → PluginSnapshot |
| GET /api/plugins/:id/versions | after?, limit=1..40 → PluginVersions |
| GET /api/plugins/:id/operations | after?, limit=1..40 → PluginOperations |
| GET /api/plugins/:id/operations/:operationId | PluginOperation |

所有游标是所列实体ID，不是event水位或跨页冻结快照；跨scope cursor不得转换成另一scope授权。输入体最大32768 UTF8字节，响应上限65536；页大小上限40，若字节先达上限提早返回nextCursor。inspect固定revision包含其version/config/grants；installation.revision仍表示当前指针，禁止当固定快照字段混用。

configure全量替换，须满足manifest必填与类型/界限，未知字段拒绝；首段没有自由文本/秘密句柄配置。set-grants仅声明能力子集，作用域继承installation，注册默认空grant。register-version只登记同package的不可变新精确version；当前选择不变。select-version清空config/grants，旧revision可查，不叫完整rollback。manifest、许可、SHA256均为operator声明，registry不认证包内容。`configurationStatus=ready`只说明字段完整，`runtimeStatus=unavailable`不会因此变可执行。

错误：400 invalid_plugin/invalid_plugin_command/invalid_cursor/invalid_query；401未认证、403 runner；404 plugin_not_found/plugin_revision_not_found/plugin_version_not_found/plugin_operation_not_found/project_not_found；409 plugin_revision_conflict/plugin_version_conflict/plugin_scope_conflict/plugin_configuration_invalid/plugin_grant_invalid/idempotency_conflict。拒绝不回显输入值。成功operation只代表PG registry提交，非包安装/宿主加载。幂等重报返回原snapshot和同operation id，不在重报时换成最新版本；新状态请GET。

接线：先在通用migrate与migrateProjects后调用 `migratePlugins(pool)`（008），owner hook后 `registerPluginRoutes(app,pool)`。单独export两个入口不改中心共享入口；Web/CLI不得绕过中心直写PG。后继resolver/loader必须有独立包验证、可用性ack、binding和动作gate，不能把本slice的grant当可执行凭证。
