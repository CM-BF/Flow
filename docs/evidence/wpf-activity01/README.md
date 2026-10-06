# ACTIVITY01 交付入口

## 当前预览状态：已退役

`http://127.0.0.1:53851/` / session46011 已按 Lead/GO 本次明确授权退役。2026-10-06T21:54:20.866804Z 仅向确证 PID31365 发 SIGTERM；原session实际 exit143，随后原父链/PGID30394和53849/53850/53851监听均无残留。未把exit143写成exit0，也不冒称每个异步handler完成。[原始回执与consumer边界](preview-retirement/README.md)。

以下原 URL、启动命令、检查与“预览保持/不关闭”均是历史记录；53851旧默认保留已被此次授权覆盖。命令仅作来源追溯，本次未重启服务，其他KEEP服务和用户页面未操作。

## 历史交付与启动说明

实现 `61b9349af390c137cc4cfeabd38bad058ec69cb5`；worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-activity`；branch `codex/web-conversation-activity`；base `3d4985fca060155435b159e0467815bf8e88b8b8`。独立活动模块，无App接线，无CHAT05/K02/renderer输入。

本地预览 [http://127.0.0.1:53851/](http://127.0.0.1:53851/) / session46011 / owner workspace_panels_owner。HTTP fixture · simulated · no model；Show activity→引用二次展开，Load more/Refresh/host complete/offline/sameID center切换。启动 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-activity.fixture.ts --activity-preview`，动态端口以stdout为准。浏览器脚本自行创建/关闭专属fixture，不关闭此长期preview或其它任务服务。

检查：`pnpm exec vitest run apps/web/test/conversation-activity.test.ts`；`pnpm --filter @flow/web typecheck`；`pnpm exec tsx apps/web/test/conversation-activity.browser.ts` 及 `--production`。[详细验证](validation.md)、[源码绑定](source-binding.json)、[Interface](interface.md)、[clean-code/技能](quality.md)。

截图：[桌面浅色](production-desktop-light.png)、[390深色](production-narrow-dark.png)、[390浅色](production-narrow-light.png)。[计划](../../../plans/wpf-activity01/plan.md)、[唯一状态](../../../plans/wpf-activity01/status.md)、[审查](../../../plans/wpf-activity01/review.md)、[领取](take-receipt.json)。

未验证：真实中心/执行器/DB/model及App组合；events不能abort底层HTTP，不开放typed工具/思考，不能把metadata标题猜成tool种类。不自动加载引用正文、不创建第二条聊天pipeline。main由Lead集成，当前未集成。

正式独立review APPROVED（root2026-10-06T06:17:33Z）：22 direct独立通过、CUA展开/详情/宿主状态/跨center/暗色/离线通过；作者14browser/typecheck/build已复核，未冒称独立重跑。claim51f962ee-7e6f-4806-a9f9-df3838dc27f5 v1保留，后续main集成由Lead完成。

## Main 集成观察

2026-10-06T06:28:42Z：Lead已集成固定main `acfd409a493315a00f1cc19ac96c5f1b36c19e57`；owner独立核target祖先和六paths零diff，见[证据](main-integration.json)。这只交付独立模块，App入口后继另领。当前metadata提交后全八scope停写并授权release，rawreceipt由管理保存，不再追写；预览保持。
