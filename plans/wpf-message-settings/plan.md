# WPF-MESSAGESETTINGS01：逐条消息设置选择控件

状态：completed；创建：2026-10-06 18:11:03 UTC；最近更新：2026-10-06 21:25:59 UTC。直接父：[WPF-MATURE-02 / TODO-11](/Users/citrine/Projects/AgentHarness/Flow-worktrees/claude-codex-capabilities/plans/wpf-mature-02-harness-capabilities/plan.md)。本片为既有需求的受控选择控件，不另建大任务。

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

- [x] MSGSET-01：公共目录、纯 capture、受控 UI 和直接边界用例。
- [x] MSGSET-02：固定源码后申请必要只读依赖与轻量 checks；官方组件 fixture 的双主题 390px/键盘/双 pane/callback 检查须独立运行准入。
- [x] MSGSET-03：固定来源/clean-code/独立审查、交付与 main 接收分别留证。

strict noEmit与37项direct PASS，原父expected20计数FAIL及三次早期browser失败原样保留。固定270c的b5实际4/4行为检查、390浅深截图、完整清理已获独立范围批准；累计28876ms，不是新增运行许可。固定main `c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05` 六源逐字接收，MSGSET-01～03完成。证据见[main回执](../../docs/evidence/wpf-message-settings/main-component-receipt.json)与[Root主线独审](../../docs/evidence/wpf-message-settings/root-main-integration-review.json)。本次仅metadata收口，无产品重测或个人部署。

## 后继与限制

App/Thread、outbox/Queue/Recovery 与真实 requested/observed 读回不在本片范围。后继须在用户提交同步栈 capture settings/intent/materials，沿同一原 key/body 持久化；本条 A、排队 B、草稿 C 独立，不以 ACK 清新稿，不把设置遗失降级普通发送。需要已有会话可信 capability 和 profile；详情渲染回调不是权限。无实际 provider/账户能力结论。

## 方法与质量

遵循[根模块规则](../../AGENTS.md#modular-design)。本地 find-skills → codebase-design/clean-code/React 方法，来源与实际应用见[技能与质量](../../docs/evidence/wpf-message-settings/quality.md)。本片已有 root 批准方案，遵循其范围，不重复规划。

历史 2026-10-06 20:47:23 UTC：b5唯一fresh准入已实际4/4 browser checks通过，390双主题截图/完整清理可核；MSGSET-02已完成，MSGSET-03待固定证据独审与main接收。累计28876/60000，余量不代表重跑许可；真实host接线仍后继，不将leaf片段冒完整设置全链。

历史 2026-10-06 20:50:09 UTC：Root已独立批准270c受控Picker范围源码/实际b5证据，0blocking。MSGSET-03独审部分完成、主线仍待；MATURE02完整App接线与成熟快速选择保持open，不把本leaf交付当父目标完成。

2026-10-06 21:25:59 UTC：本受控组件限定交付且main已接；父TODO-11中的真实host接线和成熟快速选择未勾选，本片停止全部八范围写入后交manager释放。
