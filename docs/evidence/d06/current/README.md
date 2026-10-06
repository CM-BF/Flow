# D06 当前固定快照交付

实现目标：37561609fc776c5a87dc45a11c07bd0595089e12；源码基线：eb14991a170b72d7d974428b2e440e1faada2c1e。只改既有 architecture-data.js、architecture.js、architecture.test.mjs。五视图保持，模块图增加一排已集成配置/队列/图提案；无新第二数据源、接口或任意读文件路由。

标题和底部由同一 `baseline` 生成短/全 SHA 与 UTC 源码核验时间，明确非实时运行拓扑。节点链接全部固定到 eb。源事实见 [固定 git-show 摘录](fixed-source-audit.json)，不是从 moving 工作目录或 registry 登记推实现。

## 源码事实与运行证据分开

- App 明确挂载 ConversationThread、profile catalog、X03管理视图；当前 ConversationThread 仍禁用 Queue/Steer/逐轮控制。
- 中心显式挂载 execution-profiles、conversation-queue、goal-tool-runs、goal-graph-proposals。队列 waiting/sequence 分页、revision、pause/resume 与实际前轮准入分开；O05 保存提案与 digest/revision 显式应用分开。迁移范围已到014。
- 原生goal工具桥只给予有界port，中心持有grant与fencing；不把代码存在称完整自主规划或真实模型已验收。
- P03 Send/Get显式historyLength:0且保留产物，不称总响应上限；出站未知交互仍uncertain。R04关闭HTTP连接不等数据库事务取消。通用runtime仍串行 await execute。
- 原任务FSM和PG事实保留：三个活动态均可接受completed.outcome，执行/验证分开，uncertain先审计终结再另建安全retry，PG details不画成已接blob，产品PG与工程ledgerPG分开。
- K01/SVC02在固定registry已登记但不是其实现证据；O06是本轮GoalOwner/Lead明确的后继规划，固定registry尚无O06条目。图的planned组不声称这些源码存在或服务可用，源码入口为原架构规划。常驻61227仍75a是派工给定的历史运行边界，本轮未访问/升级该服务；不把eb代码等同其运行版本。

本轮实际运行仅局部Node、静态独立预览和Chrome，无产品PG/模型调用。旧8f验证留在 [历史索引](historical-index.md)。此处不把旧真实PG/native证据改写成本轮重新执行。

## 检查与预览

- Node24.20.0：`node --test apps/execution-dashboard/test/architecture.test.mjs`，7/7 PASS，[原始输出](node-tests.txt)。固定链接/几何、静态HTTP/CSP/方法/Host限制、已集成领域与禁用Web、queue/graph、P03/R04、FSM、PG provenance。
- 本树 `pnpm9.15.4 install --frozen-lockfile --ignore-scripts`，[安装输出](install.txt)，根manifest/lock零diff，无新依赖。首次新树缺pg导致测试无法启动，保留 [初次失败](initial-missing-dependency.txt)；随后旧SQL位置断言落在commands，固定源码已抽到admission，修正定位后通过，保留 [定位失败](initial-source-location.txt)。这两次都不称通过。
- Chrome154，[浏览器脚本](browser-check.mjs)、[结果](browser-checks.json)：五视图节点label无溢出、键盘Enter/Space、固定href、标题/底部基线、双主题390、减少动画、缩放、页面无横向溢出，pageErrors=[]。截图在本目录。仅静态图UI，不是产品App或真实执行验证。
- 独立预览 `http://127.0.0.1:58207/#architecture`；启动 `node docs/evidence/d06/preview.mjs`，动态端口以stdout为准。旧55247/4320与其他owner服务保留，未重启。当前预览进程由本owner保留供审查。
- 实现固定diffcheck通过；未跑全库、产品DB、模型、Safari/Firefox/屏读或发布服务。图画布沿用小屏内部水平滚动/缩放，不声称390同时可读全图。

[模块浅色](modules-light.png) · [状态浅色](states-light.png) · [状态深色](states-dark.png) · [数据深色](data-dark.png) · [390深色](data-dark-narrow.png) · [390浅色](data-light-narrow.png)
