# WPF-I01 主 App 插件挂载

创建/更新：2026-10-06 03:00 UTC。状态：in-progress（文档与接缝准备；实现等待输入复审）。唯一 owner：workspace_panels_owner / gpt-6-astra ultra。

将已审可信 Web host、内建 WorkspacePanels 与主题接入已审 WPF-M02 产品 App，使声明式贡献在真实界面生效。继承管理计划 WPF-I01-01..04，不另造插件协议。对应用户可插拔 Web 与唯一领取要求；不因此宣称 X01 全栈 npm 生命周期、第三方隔离、CLI 或真实 PTY/任意文件系统完成。

## 输入、领取与范围

- 独立 worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-integration`；branch：`codex/web-plugin-integration`。
- 基线与初始化 HEAD：`c526c1c889437ee39155d669921577995195c74e`；其中 M02 实现 `d47c602f3bab1fe97a9be70fd37780c2918bcfbc` 已获独立 APPROVED。初始化没有改写旧工作树。
- P01 候选 `e5341915ebbffd9a667f68f7d1ca9c45c14c7c52` 仍为 REQUEST_CHANGES：PH-R4 切换 task/contribution 丢失面板局部状态，等待唯一 P01 owner 修复及 root 整体复审。此候选尚未合入。
- D04 I01 claim `b6666c29-ebc5-47b2-b754-55b62687fd00` v1 active；真实 commit receipt 与旧 M02 v2 移交见[领取证据](../../docs/evidence/wpf-i01/assignment.md)。每次新工作先核 live version/state；scope 增改须原子 amend 回执。
- 可写 literal scope 以 [status](status.md) 与回执为准。当前派发只允许本三件套和 `docs/evidence/wpf-i01` 文档；实现需已审 P01 输入与管理者正式派发。`apps/web/src/plugins` 及 plugin-host 测试仍由 P01 owner 维护；仅受控消费已审提交，不手工修 host。
- 旧 M02 的 App、TaskThread、WorkspacePanels 三路径已停止写入，并由 v2 amend 移出；不得恢复旧树写权。本 feature 不合 main，不修改 shared packages/backend/root manifest/lock。

## 方案与验收

独立 `plugin-integration` 模块拥有稳定窄 stores、HostPort bridge、连接 epoch、声明式 slot 包装与设置/诊断组合；App 保留组合与原生 UI 状态。具体落点和命令见[接缝映射](../../docs/evidence/wpf-i01/seams.md)。复用 P01 `ResourceContext`/`HostPort` 类型，局部 task/message/reference 身份必须来自当前渲染对象；不能以全局 active task 覆盖 B 行上下文。插件不接收 FlowClient、token 或任意数据访问器。

App 的 chat groups、每 task 的原生 workspace tab 与草稿保留唯一 authority；窄 store 只发布快照。内建 WorkspacePanels 保留 Files/Terminal/detail 的键盘和 task 局部布局，host contribution 选择不能重建其缓存。换中心先同步失效旧 bridge epoch/signal，再 dispose 旧 host；即使新中心 taskId 相同，旧 activation、命令与 render 闭包也不得生效。

真实消息动作放官方 Thread 的 ActionBar 内，composer 动作放 composer action 区，不以状态条/textarea 属性冒充接入。现有 composer 没有安全外部命令注册入口，本段默认 `flow.composer.insertText` 明确 unsupported；不得静默成功或直接操作 DOM。主题使用已验证 descriptor，移除旧 tokens，禁用后回退内建主题；断开中心时不清草稿以外的未经授权状态、不取消中心任务。

至少两个内建插件经同一 host 工作，sample button/menu/panel 证明扩展路径。禁用需移除贡献、订阅和面板，焦点回退可预测；局部异常可见且可重试。测试覆盖局部 B 上下文、reference 归属、连接 epoch、失败反馈、A→B→A/Notes roundtrip 状态、首屏 detail 0→显式 1→缓存、8 chat 与双 split 观察预算、双主题/390px/键盘/减少动画。fixture 与真实中心有界旅程分别记录；不将作者结果当独立 review。

## TODO

- [ ] **WPF-I01-01** 冻结两已审完整输入，完成 D04 旧 scope 转交/新 claim、新 worktree 与唯一 plan/status/review。
- [ ] **WPF-I01-02** 实现窄 App bridge 与声明式 slots，内建插件及诊断/设置接入。
- [ ] **WPF-I01-03** 运行局部桥接与产品浏览器/真实中心验收，记录双主题截图、技能与 clean-code。
- [ ] **WPF-I01-04** 固定 SHA 独立 review、修复闭环并交原 Lead 集成，不代 merge main。

## 当前风险与交接

实现目标 UNKNOWN；P01 PH-R4 为当前依赖阻塞，解除条件是固定新完整 SHA 获整体 APPROVED。文档和已审 M02 接缝研究可独立完成。新增文件若超 receipt 范围先由 Lead amend，不以 worktree 隔离代替领取。计划索引和 dashboard task→owner worktree 登记由管理者/原 Lead 维护；旧管理准备目录转只读 stub，避免两份进度。
