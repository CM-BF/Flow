# Web plugin host 接缝前置调查

来源：workspace_panels_owner只读当前W01源码回报，2026-10-06；观察HEAD2286ab11e4ce81c4ef41303a2b35e3883862d4bb且shell仍dirty，因此行号只作定位线索，不是冻结实现。以下为工程建议，不是公共后端API或已实现插件系统。当前plugin方向归X01全栈，WPF-P01只做Web host子项。

| 稳定位置 | 当前接缝与待对齐 | 前端宿主command建议 | 最小context/capability | disable清理 |
| --- | --- | --- | --- | --- |
| activityBar.primary/bottom | App竖栏 | flow.sidebar.toggle、flow.workspace.open、flow.settings.open | activeView/panelId；ui.navigate | 移除自身图标/命令，焦点回宿主入口 |
| sidebar.header/item.actions/footer | App标题/nav/footer；item应位于task行，footer生产环境也存在 | flow.chat.new/open、flow.task.inspect | 行taskId/title/status；ui.navigate/task.read | 移除action/订阅，焦点回行，不删除task |
| chat.header | App chat/group头部 | flow.chat.split/merge/close | groupId/viewId/canSplit；ui.layout | 撤贡献/监听，不cancel任务 |
| chat.message.actions | 当前标在task bar有语义偏差；应使用官方Thread AssistantActionBar，task bar另名chat.task.actions | flow.message.copy、flow.reference.open；task bar使用flow.task.cancel | taskId/messageId/role/已展示text或referenceId；clipboard/ui.navigate；cancel需宿主确认 | 撤message action/订阅，不修改中心消息 |
| chat.composer.actions | 官方Thread composer / TaskThread业务桥 | flow.composer.insertText、flow.task.submit | viewId/isDraft/canSubmit；composer.write/task.submit，文本仅显式授予 | 撤action/订阅，保留草稿和进行中的受理 |
| workspace.header/tabs/actions | WorkspacePanels头部/tablist；actions目前仅Terminal页，host阶段改通用工具区 | flow.workspace.open/close、flow.reference.open、flow.output.copy | taskId/tabId/referenceId/connection；detail按用户打开、clipboard | 关闭自身plugin tab/本地读与订阅，焦点相邻native tab，不cancel任务 |
| artifact.actions | 已加载artifact header | flow.reference.open/copy | taskId/detailId/mediaType/artifactVersion及授权已加载content | 卸renderer后回安全文本fallback，保留中心产物 |
| settings.sections | 当前Connection表单含token；扩展配置必须分离 | flow.plugin.configure、flow.settings.open | 仅本plugin验证配置schema和值；settings.own | 卸页/订阅，未保存状态由宿主处置 |
| theme.registry | themes registry/applyTheme；不是每DOM的slot | flow.theme.set | themeId/scheme/允许semantic tokens；theme.register | 删除贡献，正在使用则回内建light/dark并清override |

实现应为React声明式ExtensionSlot与typed context，不扫描DOM属性注入；data-extension-slot仅定位标记。按钮、菜单、快捷键引用同commandId，避免散落绑定。宿主命令桥校验参数/当前上下文/能力，再调用公共FlowClient；不向plugin传client/token或整表单状态。

信任限制：可信内建可同React realm运行；任意第三方JS同realm即使无token参数仍可能读DOM/fetch，不能把“未传token”称为隔离。外部包执行等待X01统一隔离/能力方案，不在Web host里宣称安全沙箱。

WPF-NAV-01后续导航问题（root发现，不无界阻断当前交付）：当前多入口hash更新不统一，激活B可能URL仍A，关闭后刷新可能重开A。交W01判断最小修或正式限制；后续command桥统一activate/close/split/merge的URL/history与布局恢复，添加刷新、前进后退、活动项关闭验收。不得为此在当前Thread整改临时构建整个plugin框架。

## 窄host接口建议与生命周期

```ts
type Disposable = { dispose(): void };
type PluginState = 'registered' | 'activating' | 'active' | 'disabled' | 'failed';
interface PluginDefinition {
  manifest: {
    id: string; version: string; hostApi: 1;
    capabilities: readonly Capability[];
    activationEvents: readonly (`command:${string}` | `view:${SlotId}`)[];
    contributions: readonly ContributionDeclaration[];
  };
  load(signal: AbortSignal): Promise<PluginModule>;
}
interface PluginModule {
  activate(context: PluginContext): void | Disposable | Promise<void | Disposable>;
}
interface PluginHost {
  register(definition: PluginDefinition): Disposable;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
  list(): readonly { id: string; version: string; state: PluginState; error?: string }[];
  execute<K extends CommandId>(id: K, args: CommandArgs[K], options?: { signal?: AbortSignal }): Promise<CommandResult[K]>;
}
interface PluginContext {
  readonly signal: AbortSignal;
  commands: ScopedCommands;
  context: NarrowContextReadsAndSubscriptions;
  contribute(declarationId: string, implementation: ContributionImplementation): Disposable;
  own(disposable: Disposable): void;
}
```

这些是待实现类型草图，Capability/SlotId/CommandArgs等须在实际host阶段定义并对齐X01，不是现有公共contracts。manifest为JSON声明，无回调；load仅固定受信构建入口，不任意URL。register校验与预留命名ID，不执行load。明确command或view事件才lazy activate。host绑定plugin身份/generation，不能让callerId参数伪造身份；执行时重验授权。

激活贡献暂存，成功且generation有效才一次发布；失败全部回滚。deactivate先禁dispatch、abort、generation++，再撤UI/订阅/timer/theme并逆序幂等dispose；一个dispose异常不能跳过其余。迟到load/activate不得挂回；并发activate共享Promise，而execute保留每次独立合法请求，不错误去重用户命令。

有意义行为验证：未打开不load；并发激活一次；pending激活disable后迟到结果/贡献丢弃且dispose一次；新generation不受旧promise污染；ID冲突/host版本/未声明贡献原子拒绝；展示层隐藏不代替execute权限检查且动态撤权生效；跨task/resource上下文不绕权；activation/command/render各自错误隔离与归属；窄订阅、停用后listener/observer/timer清零；活动tab焦点回邻项、message不变、草稿保留、theme fallback；逃逸声明文本、未知renderer安全fallback，声明本身不触发网络/模型/PTY/fs。以上可信host测试不等于外部包隔离或完整X01生命周期通过。
