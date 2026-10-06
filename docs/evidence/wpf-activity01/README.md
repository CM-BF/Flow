# ACTIVITY01 交付入口

实现 `61b9349af390c137cc4cfeabd38bad058ec69cb5`；worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity`；branch `codex/web-conversation-activity`；base `3d4985fca060155435b159e0467815bf8e88b8b8`。独立活动模块，无App接线，无CHAT05/K02/renderer输入。

本地预览 [http://127.0.0.1:53851/](http://127.0.0.1:53851/) / session46011 / owner workspace_panels_owner。HTTP fixture · simulated · no model；Show activity→引用二次展开，Load more/Refresh/host complete/offline/sameID center切换。启动 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-activity.fixture.ts --activity-preview`，动态端口以stdout为准。浏览器脚本自行创建/关闭专属fixture，不关闭此长期preview或其它任务服务。

检查：`pnpm exec vitest run apps/web/test/conversation-activity.test.ts`；`pnpm --filter @flow/web typecheck`；`pnpm exec tsx apps/web/test/conversation-activity.browser.ts` 及 `--production`。[详细验证](validation.md)、[源码绑定](source-binding.json)、[Interface](interface.md)、[clean-code/技能](quality.md)。

截图：[桌面浅色](production-desktop-light.png)、[390深色](production-narrow-dark.png)、[390浅色](production-narrow-light.png)。[计划](../../../plans/wpf-activity01/plan.md)、[唯一状态](../../../plans/wpf-activity01/status.md)、[审查](../../../plans/wpf-activity01/review.md)、[领取](take-receipt.json)。

未验证：真实中心/执行器/DB/model及App组合；events不能abort底层HTTP，不开放typed工具/思考，不能把metadata标题猜成tool种类。不自动加载引用正文、不创建第二条聊天pipeline。main由Lead集成，当前未集成。

正式独立review APPROVED（root2026-10-06T06:17:33Z）：22 direct独立通过、CUA展开/详情/宿主状态/跨center/暗色/离线通过；作者14browser/typecheck/build已复核，未冒称独立重跑。claim51f962ee-7e6f-4806-a9f9-df3838dc27f5 v1保留，后续main集成由Lead完成。
