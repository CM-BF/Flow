# WPF-X03I01 交付入口

固定实现 `84acdcaaa9687a4ca75ebdb40a6efc7e5539029a` / base `4e0289f29ffa48c6c49003837d4520f57c22b6b0`。branch codex/web-plugin-management-integration。三生产接缝+两个专测，本批仅已审X03真实App入口；独立review入口见[review](../../../plans/wpf-x03-plugin-integration/review.md)，已于04:36:39 UTC获root独立APPROVED，尚未main集成。

在现有 **Extensions and appearance → Plugin management** 展开。Personal center registry只读显示版本/config/grants/audit；下方This browser connection独立显示本地trusted runtime，上方原本地controls继续启停，不把注册记录按名字匹配本地插件。关闭/折叠停止读取，换中心以session.id清除旧读取状态。模块加载失败可继续聊天，需先保留未发送文字再手动reload；不自动重载。

[唯一status](../../../plans/wpf-x03-plugin-integration/status.md) · [plan](../../../plans/wpf-x03-plugin-integration/plan.md) · [validation](validation.md) · [源码与报告hash](source-manifest.json) · [技能/clean-code](quality.md) · [正式receipt](take-receipt.json)。四张双主题截图在validation下钻。

## 可看版本与启动

http://127.0.0.1:59473/，owner workspace_panels_owner，exec session96967，固定同内容源码。**HTTP fixture模拟、无真实中心/DB/模型**，页面保留fixture标记。现有49922/55049/63743与55247保持。恢复命令在本tree执行，端口由stdout动态分配：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/plugin-management-integration.fixture.ts --app-preview
```

正式App在Lead已认证中心仍用既有FLOW_CENTER_URL代理或Center URL/password输入；不在此记录任何owner token。首次Personal registry请求是GET /api/plugins?limit=10，展开前0；无新增共享接口、写操作或模型。

局部验证命令：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/plugin-management-integration.browser.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH VITE_FLOW_FIXTURE=true pnpm --filter @flow/web build
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/plugin-management-integration.browser.ts --production
```

脚本只清理自己创建的临时服务。fixture构建不是正式真实中心配置，发布需VITE_FLOW_FIXTURE=false。7个精确scope来自receipt，不改Mika plugin-management、host/session、官方Thread或共享契约；后续缺陷交各自owner。
