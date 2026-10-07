# 插件 UI 订阅性能：固定源码研究

结论：当前没有足以新开生产优化任务的性能证据。已有 host 不在导航/任务数据更新时重建插件注册快照；按 slot 的缓存已存在。更明确的候选是 React 端每次 render 重新订阅，以及 PluginView 的全注册表失效范围，但都尚无规模/延迟实测。先归既有性能研究和插件后继输入，不给已完成 PERF01/02/03 追加第二手填进度，也不阻塞当前发布。

固定源码 main b37e404da18d8b63a5b38ad20cf55850a9781dd5；7 项路径完整 hash/blob 见 pins.json。仅读源码和既有 PERF01 记录，没有 import、执行测试、浏览器、服务、资源采样或写权领取。

## 已存在的正确边界

- host.ts:72–87 为稳定 list/slot 快照与分槽 listeners；publish:608 起仅针对 entry 声明涉及的 slots 重建快照。注册、激活、禁用等生命周期会 publish；不能把它说成每 token 的热路径。
- plugin-host.test.ts:354–373 已有导航不改 list/slot identity 的断言。本次只读该测试，没执行，不能写当前 PASS。
- 插件是可信同 realm、具名16 slots/窄 HostPort；builtins 使用 dynamic import。不要为性能把完整 client/权限/私有 session 暴露给插件，也不预加载所有插件。
- PluginTabs 只 render 已访问的 panel，并用 Activity 保留 UI state；这符合切 tab 不丢内容的用户要求。Activity 隐藏会清理 Effects，仍可因 props 变化低优先级 render，保留的 DOM 自身仍可能有行为；不能称隐藏就零 CPU/零内存/零所有副作用。[React Activity](https://react.dev/reference/react/Activity)

## 有依据但未测量的两个候选

1. ExtensionSlot 和 PluginTabs 把 `(listener) => host.subscribeSlot(slot, listener)` 内联传给 useSyncExternalStore。新函数 identity 导致 React 重订阅，是库文档定义的机制，不等于当前卡顿证据。[React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
   若未来确认高频 parent render 带来明显订阅 churn，最窄候选是在原 React 模块以 host/slot 为依赖稳定 subscribe；保留最新 context 给按钮操作，不为减少 render 冻结权限或 resource identity。当前不提出全局订阅缓存/新 store/通用 selector 框架。
2. PluginView 订阅 host.subscribe/list，任一插件生命周期 publish 都可失效当前 view；只是低频注册数据，不是 workspace 流式投影。如果插件规模下有实测扇出成本，再研究 contribution snapshot。不能只按 contributionId 缓存 renderer/bind 或漏掉 session disable/revoke；全部依赖必须保留权威的 generation/当前权限检查。当前不存在需要给 host 增新 public interface 的证明。

全表 findContribution 扫描、map/filter、dispose 的多次 publish 也是源码可见的工作量，但当前规模/次数/壁钟未知。不要凭复杂度猜测瓶颈、为漂亮 benchmark 新造大量实现。

## 未来验收应测什么

最小先观测 subscription add/remove、slot/list notifications、真实可见 view 更新与插件 lifecycle 事件的关系；区分 parent props 更新和 host publish。普通直接 host 测试不能证明 React 实际重订阅或生产渲染耗时。已有 plugin-host fixture 可用于代表验证，但依然不能冒真实 App 或用户 INP。

如有收益证据，进行同构建模式/同负载前后比较，记录样本数、实际 active/retained panes、插件数量、输入/滚动、网络活动与测试开销。少量自动化动作只报原始耗时，不发布 p95/SLA/泄漏结论。仍保键盘移除 tab 回焦点、未知命令原 key、跨权限迟到响应、保留草稿和 ordered refs。降低订阅次数但破坏任一正确性不是优化。

## 技能与 clean-code 停点

本地 find-skills 方法先查既有 React/性能技能；采用 /Users/citrine/.agents/skills/vercel-react-best-practices/SKILL.md（metadata version1.0.0）及 rerender-defer-reads/rerender-dependencies/rendering-activity 三规则；沿已读 clean-code/codebase-design，审接口、单一状态来源和必要复杂度。发现：本地 Activity 指南“避免昂贵重渲染”的简述不能解读为完全不 render，已用 React19.3 官方说明收窄。未改代码、未测性能、无新 claim/运行/验收结论；报告作为原计划设计输入。
