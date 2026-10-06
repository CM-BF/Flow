# D06 115b 架构数据刷新交接

架构图补齐Web排队、项目知识/会话上下文和受限图工具，分开独立模块、已接产品和后继。固定源码基线 `115b0dbdfa02db5483f9e9699852682ce699633c`；实现 `ff5ca7c880910841e8180df7632753c81aea2492`。branch `codex/dashboard-architecture-context`，独立树 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-architecture-context`。当前审查修复目标独立review NOT_STARTED，main未集成此图。

仅五实现路径：architecture-data.js、architecture.test.mjs与本目录source-audit.mjs/browser-check.mjs/preview.mjs。renderer/CSS/App/shared/rootmanifest-lock无修改。X04只压缩包落盘，不是npm安装启用；renderer模块已含但App未挂，CHAT05/06不在固定115b，图不追后来的main。个人服务fb906由其owner管理，本图不是服务部署证明。

[plan](../../../../plans/d06-architecture-refresh/plan.md) · [status](../../../../plans/d06-architecture-refresh/status.md) · [review](../../../../plans/d06-architecture-refresh/review.md) · [验证](validation.md) · [source审计](source-audit.json) · [hash绑定](source-binding.json) · [技能/clean-code](quality.md) · [领取](take-receipt.json) · [历史](history.md)。

## 查看与启动

[独立静态预览](http://127.0.0.1:58394/#architecture)，owner workspace_panels_owner / session63057。空fixture registry，无实时状态/领取DB；4320及旧服务均未变更。恢复命令（动态端口以stdout为准）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node docs/evidence/d06/context/preview.mjs
```

依赖本树 `pnpm install --offline --frozen-lockfile`，Node24.20.0 / pnpm9.15.4，540已有包复用、0下载、无manifest/lock修改。验证：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH node --test apps/execution-dashboard/test/architecture.test.mjs
PATH=/opt/homebrew/opt/node@24/bin:$PATH node docs/evidence/d06/context/source-audit.mjs
PATH=/opt/homebrew/opt/node@24/bin:$PATH node docs/evidence/d06/context/browser-check.mjs http://127.0.0.1:58394/
```

[模块浅色](modules-light.png) · [状态深色](states-dark.png) · [数据390深色](data-dark-narrow.png) · [数据390浅色](data-light-narrow.png)。本人实际目视模块浅色和390深色，页面无横溢出，画布保留原受控横向滚动与缩放。

未验证真实服务部署、模型/产品DB、执行容量、Safari/Firefox/屏读；固定图验证不能替代各产品领域验收。06:36 manager唯一聚合已确认本树source迁移，原样摘录见[dashboard](dashboard-excerpt.json)。正式集成/4320图切换由MainLead执行。
