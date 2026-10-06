# X03 接线接口

命名导出：`apps/web/src/plugin-management/PluginManagement.tsx` 的 `PluginManagement` 与 `PluginManagementProps`。

```tsx
<PluginManagement
  open={settingsOpen}
  sessionId={session.id}
  registry={registryReader}
  runtime={session.host}
  scope={{ projectId: selectedProjectId ?? null }}
  scopeLabel={selectedProjectTitle}
/>
```

组件接收的 `registry` 类型仅为 `Pick<FlowClient, 'plugins' | 'plugin' | 'pluginVersions' | 'pluginOperations'>`。App持有既有授权client，可直接将其作为该窄读接口传入，或以useMemo创建调用对象方法的bound wrapper；不可解构未绑定的client方法。实例只在App→管理视图边界使用，不传入PluginContext、host port、注册或contribute过程。

`runtime` 类型仅为 `Pick<PluginHost, 'list' | 'subscribe'>`。host既有两方法是绑定箭头成员；组件只订阅/读快照，不调用register/activate/deactivate。`sessionId`必须为当前AppPluginSession.id，中心连接更换后更换该值。scope仅允许既有PluginScope的projectId，workspace固定personal；省略/null显示Personal workspace registrations并只读个人范围，有projectId则请求该projectId且明确Project registrations，可带现有选择的label，无手输ID/新项目系统。

未打开/open=false时无读取子树、零registry请求；关闭取消所有当前读取。sessionId或projectId改变直接销毁旧子树/状态并取消旧读取，旧Promise即使忽略取消迟到也被拒绝。调用方保持reader实例稳定，避免无意义重读；不存在跨连接共享缓存。列表每页10条，下一页替换当前页，详情、版本、审计只在用户展开时读取。

本模块不拥有导航触发器、Dialog/focus恢复或App会话创建；WPF-CHAT01 owner在既有settings/App上下文做最小组合。模块fixture位于`apps/web/test/plugin-management/fixture`，不构成真实App入口已完成；真实App两主题/390px、连接切换和开闭读取须在挂载后另验。
