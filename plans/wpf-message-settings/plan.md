# WPF-MESSAGESETTINGS01：逐条消息设置选择控件

状态：in-progress；创建：2026-10-06 18:11:03 UTC；最近更新：2026-10-06 20:38:50 UTC。直接父：[WPF-MATURE-02 / TODO-11](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)。本片为既有需求的受控选择控件，不另建大任务。

## 目标与范围

展示中心已配置的完整模型/思考/力度/速度组合，保留宿主当前草稿选择与已冻结消息设置的独立身份。复用分页目录生命周期、公共 codec 和已有 Dialog/details 导航接缝。原会话创建选择与 readonly 参数修复保持。

固定基线 `8d84d529a0756116bd0fc8bad969d61a6c26248e`；唯一 worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-message-settings` / `codex/web-message-settings`。精确八范围：

- `apps/web/src/execution-profiles/catalog.ts`
- `apps/web/src/execution-profiles/selection.ts`
- `apps/web/src/execution-profiles/ExecutionProfilePicker.tsx`
- `apps/web/test/message-settings.test.ts`
- `apps/web/test/message-settings.fixture.tsx`
- `apps/web/test/message-settings.browser.ts`
- `plans/wpf-message-settings`
- `docs/evidence/wpf-message-settings`

## Interface 与已确认决定

catalog 的两种协议共享私有分页/取消/代际实现，分别验证公共页面；新 reader 为已绑定的 `FlowClient.claudeMessageSettingsProfiles` closure。只在显式 refresh/loadMore 读取。

selection 仅预校验并深冻结公共 `ClaudeTurnSettings`；完整 profile 三元组、当前可信 capability、目录完整 tuple 都须一致。省略与显式 not-requested 不等同。中心仍是准入权威，不承诺 provider 支持。

Picker 由宿主传入 value/onChange；只持有 Dialog 展开状态，不增加草稿存储。选择完整 tuple，不组合独立轴。实际 requested model 与创建基准 model 分开。首层直接展示下一条的模型、思考/力度、速度与必要不可用原因；Runner/Profile ID、digest 等工程身份仅在 details，不能让用户先读协议。details(navigate) 只扩展展示，关闭/焦点交接后调用宿主动作，不扩展授权。

## 验收与阶段

- MSGSET-01：公共目录、纯 capture、受控 UI 和直接边界用例。
- MSGSET-02：固定源码后申请必要只读依赖与轻量 checks；官方组件 fixture 的双主题 390px/键盘/双 pane/callback 检查须独立运行准入。
- MSGSET-03：固定来源/clean-code/独立审查、交付与 main 接收分别留证。

当前 strict noEmit 与37项 direct 已运行通过；原父 expected20 计数断言 FAIL 保留并由独审分类，不重跑。浏览器准备源码已限定独审；首次获准入口运行5197ms后在Chrome CDP就绪前失败，0界面断言/截图，清理完成且窗口归还。fixture扫描与短owned Mac临时目录/退出证据已源码审；新独立准入运行8551ms后Chrome SIGTRAP，0界面断言，当时累计13748/60000，清理完毕、未自动重试。第三次b4在明确native边界接受后，6861ms实际到达fixture，首group定位器歧义失败/0完成checks，累计20609/60000、余39391；双PGID与scratch清理完成，未重跑或修改原断言。270c唯一named group定位器窄修已获限定源码批准、browser尚未复验；b5软停止修复及精确native边界已限定批准，候选仍PREPARED/no gate；最终HEAD重绑与运行准入独立。无安装、依赖写入、PG、build 或真实服务采样。

## 后继与限制

App/Thread、outbox/Queue/Recovery 与真实 requested/observed 读回不在本片范围。后继须在用户提交同步栈 capture settings/intent/materials，沿同一原 key/body 持久化；本条 A、排队 B、草稿 C 独立，不以 ACK 清新稿，不把设置遗失降级普通发送。需要已有会话可信 capability 和 profile；详情渲染回调不是权限。无实际 provider/账户能力结论。

## 方法与质量

遵循[根模块规则](../../AGENTS.md#modular-design)。本地 find-skills → codebase-design/clean-code/React 方法，来源与实际应用见[技能与质量](../../docs/evidence/wpf-message-settings/quality.md)。本片已有 root 批准方案，遵循其范围，不重复规划。
