# D08 显式任务关系交付入口

首页卡片和详情读取每个唯一status的所属大task/co-lead；明确大task可无parent。缺失、重复、多父、自引用、第三层、未知注册、错误链接及陈旧/frozen来源不会被推断为可靠关系。不汇总或继承进度。原链接只文本，导航经过登记task与原资料allowlist。

本地独立样本预览：<http://127.0.0.1:54272/>，owner workspace_panels_owner，session 43846。样本只有两个临时Git任务，不是111真实源或已部署4320。

恢复命令（Node24/pnpm现有锁，动态端口以stdout为准）：

```sh
cd /Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-task-links
PATH=/opt/homebrew/opt/node@24/bin:$PATH node apps/execution-dashboard/test/task-links.browser.mjs --preview
```

[Interface](interface.md)、[Validation](validation.md)、[Quality](quality.md)、[checks](checks.json)、[browser](browser-results.json)。浅深截图：[desktop light](home-desktop-light.png)、[desktop dark](home-desktop-dark.png)、[390 light](home-narrow-light.png)、[390 dark](home-narrow-dark.png)、[detail](detail-narrow-dark.png)。

使用Enter打开卡片父任务；详情里父任务按钮替换同一对话框并聚焦新标题；Escape回原触发按钮。原文以details/summary可达，不生成链接。当前原D01没有层级声明，这种真实资料不会由D08反向改写；更正必须由其合法owner处理。

实现target及review见唯一[status](../../../plans/d08-task-links/status.md)。main接收/4320部署未完成，不把本地样本当生产事实。
