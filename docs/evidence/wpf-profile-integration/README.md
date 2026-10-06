# 聊天执行配置接线

固定实现：`2e4c5fe7d795e397ab1b1e492605562a847c5fb0`；base `698ffcd94ae073b23bcc67f6665fb19f707a93e4`。本片把已审PROFILE模块接到实际App；整份配置选择→首CREATE冻结→既有会话锁定。不是任意model/effort/access编辑器，也不代表runner/provider在线。实际effective仍来自执行器证据。

唯一计划：[plan](../../../plans/wpf-profile-integration/plan.md)、[status](../../../plans/wpf-profile-integration/status.md)、[review](../../../plans/wpf-profile-integration/review.md)。[claim receipt](take-receipt.json) 7f1daa29-78e0-463e-ab88-99e295e9e648 v1 active，review修复期保留。旧CHAT移出文件见[amend](chat-amend-receipt.json)。

## 查看与恢复

当前开发预览：<http://127.0.0.1:51832/>，服务owner workspace_panels_owner，session 68857。明确HTTP fixture模拟，无真实模型、数据库或center授权联调。独立进程不由自动测试cleanup管理，旧49922/55049/63743/59473及D06、真实SVC均未改动。预览源码已与固定实现一致，后续metadata不会改产品。

从本worktree启动（动态端口以stdout为准）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/execution-profile-integration.fixture.ts --profile-preview
```

首次首页自动连专用fixture A；公开测试token为`flow-fixture-only`。现进程A/B为51830/51831；恢复后端口会变，请用stdout的公开fixture地址。真实SVC继续由MainLead管理，本任务没有读取其凭据或换构建。

新聊天点击`Execution profile: Runner default`，可见同模型不同runner的两项、goal-tools/未知access禁选项与明确分页。选择后首条Enter或按钮发送将锁定配置；创建受理后的新草稿保持可编辑。旧Conversation 1–8均为无pin兼容会话。模拟故障注入仅在下面的独立脚本中，不暴露产品调试按钮。

## 检查与截图

[验证范围和原始失败](validation.md)、[质量/技能](quality.md)、[源码hash绑定](source-binding.json)。60直接检查、开发9组、生产9组、typecheck/build通过；root05:11:08 UTC限定APPROVED固定2e4，独立44direct通过，详细检查/未执行边界见canonical review。[05:12:10单次看板实采](dashboard-snapshot.json)已聚合目标/通过/审查/claim且无issues。

- [浅色桌面](profile-light.png) / [深色桌面](profile-dark.png)
- [浅色390](profile-light-390.png) / [深色390](profile-dark-390.png)
- [锁定配置390](profile-locked-dark-390.png)

已知展示限制：已审模块的锁定块常显UUID/digest，390px占据较多聊天高度；root已实际观察并交后继模块紧凑化队列。本片无CSS/模块写权，不声称这项体验优化完成。构建仍有两个>500kB警告，不声称整体性能预算达标。main集成与真实provider验证待Lead，0新增付费调用。
