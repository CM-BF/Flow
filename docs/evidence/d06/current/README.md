# D06 当前固定快照交付

最终实现/测试目标：5ec6ce2051ed399be4906c6f99f7183e0ed1bb66；源码基线：eb14991a170b72d7d974428b2e440e1faada2c1e。三应用实现文件为 architecture-data.js、architecture.js、architecture.test.mjs；实施范围另含本轮两个可执行浏览器测试 browser-check.mjs / review-fix-check.mjs，不能把它们当 metadata。五视图保持，模块图增加一排已集成配置/队列/图提案；无新第二数据源、接口或任意读文件路由。

标题和底部由同一 `baseline` 生成短/全 SHA 与 UTC 源码核验时间，明确非实时运行拓扑。节点链接全部固定到 eb。源事实见 [固定 git-show 摘录](fixed-source-audit.json)，不是从 moving 工作目录或 registry 登记推实现。

## 源码事实与运行证据分开

- App 明确挂载 ConversationThread、profile catalog、X03管理视图；当前 ConversationThread 仍禁用 Queue/Steer/逐轮控制。
- 中心显式挂载 execution-profiles、conversation-queue、goal-tool-runs、goal-graph-proposals。队列 waiting/sequence 分页、revision、pause/resume 与实际前轮准入分开；O05 保存提案与 digest/revision 显式应用分开。迁移范围已到014。
- 原生goal工具桥只给予有界port，中心持有grant与fencing；不把代码存在称完整自主规划或真实模型已验收。
- P03 Send/Get显式historyLength:0且保留产物，不称总响应上限；出站未知交互仍uncertain。R04关闭HTTP连接不等数据库事务取消。通用runtime仍串行 await execute。
- 原任务FSM和PG事实保留：三个活动态均可接受completed.outcome，执行/验证分开，uncertain先审计终结再另建安全retry，PG details不画成已接blob，产品PG与工程ledgerPG分开。
- K01/SVC02在固定registry已登记但不是其实现证据；O06是本轮GoalOwner/Lead明确的后继规划，固定registry尚无O06条目。这些编号只作本证据的管理输入说明；D06-R2修复已从图节点去掉编号，只展示固定Thread禁用控件及总计划的能力方向。图不声称对应派工在固定文件中已有记录。常驻61227仍75a是派工给定的历史运行边界，本轮未访问/升级该服务；不把eb代码等同其运行版本。

本轮实际运行仅局部Node、静态独立预览和Chrome，无产品PG/模型调用。旧8f验证留在 [历史索引](historical-index.md)。此处不把旧真实PG/native证据改写成本轮重新执行。

## 检查与预览

- Node24.20.0：`node --test apps/execution-dashboard/test/architecture.test.mjs`，7/7 PASS，[原始输出](node-tests.txt)。固定链接/几何、静态HTTP/CSP/方法/Host限制、已集成领域与禁用Web、queue/graph、P03/R04、FSM、PG provenance。
- 本树 `pnpm9.15.4 install --frozen-lockfile --ignore-scripts`，[安装输出](install.txt)，根manifest/lock零diff，无新依赖。首次新树缺pg导致测试无法启动，保留 [初次失败](initial-missing-dependency.txt)；随后旧SQL位置断言落在commands，固定源码已抽到admission，修正定位后通过，保留 [定位失败](initial-source-location.txt)。这两次都不称通过。
- Chrome154，[浏览器脚本](browser-check.mjs)、[结果](browser-checks.json)：五视图节点label无溢出、键盘Enter/Space、固定href、标题/底部基线、双主题390、减少动画、缩放、页面无横向溢出，pageErrors=[]。截图在本目录。仅静态图UI，不是产品App或真实执行验证。
- 独立预览 `http://127.0.0.1:58207/#architecture`；启动 `node docs/evidence/d06/preview.mjs`，动态端口以stdout为准。旧55247/4320与其他owner服务保留，未重启。当前预览进程由本owner保留供审查。
- 最终五文件实现固定diffcheck通过；完整base→HEAD差异保留原始 initial-source-location.txt 第22/61行尾空格两处，不清洗失败日志；未跑全库、产品DB、模型、Safari/Firefox/屏读或发布服务。图画布沿用小屏内部水平滚动/缩放，不声称390同时可读全图。

[模块浅色](modules-light.png) · [状态浅色](states-light.png) · [状态深色](states-dark.png) · [数据深色](data-dark.png) · [390深色](data-dark-narrow.png) · [390浅色](data-light-narrow.png)

## 复审修复、时间与检查绑定

D06-R2（P3、来源追溯）：root在375发现planned编号不能由固定计划证明。1ca3e5b只修两个节点，Queue/Steer依据固定ConversationThread，总计划方向依据原plan；后继派工编号和常驻服务不再塞进固定source节点。7局部Node再过，见 [输出](review-fix-node-tests.txt)。两节点/href补验与最新图见 [局部脚本](review-fix-check.mjs)、[结果](review-fix-browser.json)、[浅色模块](review-fix-modules-light.png)、[390深色模块](review-fix-modules-dark-narrow.png)。首轮补验脚本误用HTMLElement innerText读SVG失败，原 [失败](review-fix-svg-read-failure.txt) 保留；改DOM textContent后通过。未重跑不受影响的全五视图。

初次browser原JSON时间05:29:53.726Z是提交前工作树捕获，作者确认三应用文件至375提交间无变化；不是事后伪写JSON带实现SHA。baseline verifiedAt=05:30:00Z表示该分钟源码核验收口，不是截图捕获/自动测试/服务发布时间。原始图仍保留当时两个planned节点文案，最新两张补图对应1ca生产修复。固定 [源码hash与绑定](source-binding.json) 列原375、最终目标与工作树hash；最终目标中的两个浏览器脚本明确归入实现范围。当前独立结论待root复审，不自动继承375检查。
