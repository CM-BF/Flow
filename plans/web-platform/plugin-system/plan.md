# WPF-P01 Web 插件 host 与 UI 扩展（X01 子项）

创建/更新：2026-10-06。状态：`accepted`（方向已授权，实施排队）；唯一计划/status owner：d01_owner / gpt-6-astra ultra。父计划：[WPF-001](../plan.md)。固定基线 `d444608ab6c796c731e44e51a892868bf39bec2a`；当前文档在 `codex/web-platform-management`，不代表实现已开工。

## 范围与约束

用户已授权完整 plugin 系统；本计划只负责既有 X01 的 Web host/UI 扩展实施子项，不把 UI slots 等同完整系统。X01父范围覆盖 npm install/enable/disable/upgrade/remove、版本/配置/能力作用域、trusted server 与 isolated third-party、tool/renderer/verifier、CLI等价、未知UI通用fallback和唯一compression owner。原P01是协议接入，不复用编号。共享contracts、公共命令、中心权限与隔离由原Lead X01/M02统一；本计划只提交能力需求，不另造公共协议。

已确认方向：全部内置组件按可插拔边界设计，适当位置能加按钮/菜单/页签。工程建议：窄 PluginHost 暴露 register/activate/deactivate/list/execute 与 disposables；贡献引用稳定 commandId，同一命令供按钮、菜单、快捷键使用。不把每个DOM节点包装Slot，不先扩散全局context。

稳定扩展位置建议：`activityBar.primary/bottom`、`sidebar.header/item.actions/footer`、`chat.header/message.actions/composer.actions`、`workspace.tabs/header/actions`、`artifact.actions`、`settings.sections`、`theme.tokens`。实现时核对W01稳定布局，更新接口说明后固定版本。

## 阶段、验收与风险

1. 对齐X01/M02父要求、权限/命令命名、host API版本及唯一owner；独立worktree与空槽具备后实施。
2. 建窄host与注册/激活生命周期。至少两个真实内置功能（例如files/terminal/theme）使用同接口，sample插件不修改核心即可新增button+tab+menu。
3. 行为验证：重复ID拒绝、版本不兼容诊断、激活失败原子回滚、disable清理listener/command/tab/renderers、执行时重新核权限/上下文、单插件错误隔离/重试、卸载后无残留。
4. manifest先注册，重组件按activation event导入；流式token不广播刷新全部plugin；加载失败/离线提供恢复。性能以实际测量，完整系统验收等待X01后端/CLI环节。

订阅/异步生命周期补充：useSyncExternalStore保持同一未变snapshot和稳定subscribe；按slot/command窄订阅，流式token不重绘全host。lazy activation与loading/error boundary局限插件panel；并发activate和disable期间迟到resolve不能重新注册，disable只释放本地观察，不能默认取消已受理中心任务。验证真实listener/observer清理。

工作假设：先支持受信任内置Web扩展，第三方隔离边界交X01设计；未验证第三方模块安全执行，不宣称完成。实现owner尚待空槽派发，当前管理者只维护计划，不重复写W01。

## TODO

- [ ] **WPF-P01-01** 与X01/M02确认Web子项、接口版本、能力模型与独立实现owner。
- [ ] **WPF-P01-02** 实现host、稳定贡献位置、至少两项真实内置plugins及sample扩展。
- [ ] **WPF-P01-03** 验证生命周期/错误隔离/权限/清理与双主题键盘，记录生产性能变化。
- [ ] **WPF-P01-04** 独立review、提交集成清单并核对X01全栈剩余验收。

## 来源与变更

需求见父计划U00～U07及稳定REQ表；工程研究/官方出处见[研究台账](../../../docs/evidence/web-platform/research.md)。2026-10-06首版：建立独立验收与唯一status/review；未实施事项保持pending。
