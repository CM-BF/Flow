# D06 固定基线架构刷新

状态：in-progress。更新：2026-10-06 05:34 UTC。唯一 owner：w01_owner；派发模型 gpt-6-astra / ultra（运行时未另提供型号证明）。

目标：沿既有五视图，将源码事实刷新到固定已发布提交 `eb14991a170b72d7d974428b2e440e1faada2c1e`，并在标题旁公开固定快照与源码核验时间。该图不代表实时服务部署或所有在研分支。

## 已确认范围

- worktree `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-current`；branch `codex/dashboard-architecture-current`；base eb14991。
- 正式 [take receipt](../../docs/evidence/d06/current/take-receipt.json)：e5b2fb56-8e3a-40b7-bfa4-192f34187c0b v1；05:26:27.385Z live 核 active，旧 D06 f619 v2 已释放。旧树只读，唯一来源由 Lead 迁移，不新增第二 D06。
- 五个 literal scopes：architecture-data.js、architecture.js、architecture.test.mjs、本目录、docs/evidence/d06。CSS/index/server/registry/shared 不改。
- 保留单一 baseline 数据、五视图与任务状态机语义；只修正已集成/规划和固定来源。标题与底部消费同一 baseline，显示短 SHA、UTC 核验时间与非实时声明。
- O05 已包含于本基线；K01/O06/SVC02 只作 planned。持续聊天、执行配置、插件管理、队列中心、R04/P03 按固定源码逐项核验，不能从依赖存在推运行验收。常驻 61227 仍是历史 75a 服务，不能称本轮升级。
- 产品 PG 正文、独立工程领取 PG、assistant-final/usage/verification/task status 的边界保持。架构影响仅策展图与固定版本提示，不改运行 Interface。

## TODO 与验收

- [x] D06-01：新树/claim/技能与同一 canonical 来源切换；保留旧 8f 审查历史。
- [x] D06-02：固定 eb 源码核验、刷新五图事实与标题，所有链接统一同一提交。
- [x] D06-03：局部 Node/source 检查与动态独立预览；五图、双主题、390px、键盘、减少动画；记录 clean-code。
- [ ] D06-04：固定候选独立 review、真实聚合与 Lead 集成；实现审查和 main/服务分别记录。

## 验证与边界

不安装新依赖、不调模型或产品数据库，不改 4320/旧 55247 等服务。公开模块与静态 HTTP 局部测试，浏览器只用独立动态预览。运行验证单列原证据来源，不重跑产品套件，不声明容量/真实模型/新服务已通过。新实现 target 默认 NOT_STARTED，不继承旧 approval。

旧轮：ef42277ff55d1cbb76ea707836481a9788619033/base8f 独审 APPROVED 并已集成，其 [plan](../../docs/evidence/d06/current/historical-8f-plan.txt)、[status](../../docs/evidence/d06/current/historical-8f-status.txt)、[review](../../docs/evidence/d06/current/historical-8f-review.txt) 原文保留；其中旧 active claim 是当时记录，当前领取以新 receipt/live 为准。

[status](status.md) · [review](review.md) · [本轮质量](../../docs/evidence/d06/current/quality.md)

05:33:19 UTC root正式APPROVED最终5ec6ce2，R2来源修正关闭；D06-04的review已完成，Lead集成/最终聚合仍待，故不提前勾选整项。
