# WPF-PERF02 Activity 列表有界渲染准备

2026-10-06；03:25曾暂缓且无事务，03:30主线允许CHAT合同未ready时并行后已正式d36v1受领。本文件是管理准备计划。唯一准备owner d01_owner / gpt-6-astra ultra，未来实施拟w01_owner，已受领新writer范围，canonical初始化待回传。父[WPF-001](../plan.md)，依赖[PERF01 canonical](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-performance/plans/wpf-perf01-web-performance/plan.md)。正式派发时移交独立tree/branch与平级canonical三件套，本目录转stub。

## 问题与证据边界

PERF固定M02输入c526，1/16/128任务各10000新增均呈现10040条、约7万DOM；root只读raw一致性已核，reveal综合壁钟约2.5秒、整场maxLongTask约705～719ms。指标是一次本地生产fixture样本，不能推真实用户p95、模型容量或把所有长任务归因于列表。源码全量map和anchor遍历给出有界列表/行渲染/滚动锚点成本的实证候选；不预设某框架必然解决。

本轮先保留projection中的全部记录与公共HTTP契约，只有显示窗口/行生命周期与锚点查找可优化。不能删记录、丢引用、隐瞒错误、减小负载或不允许用户查看历史来改善数字。完整host、I01 App/Thread/WorkspacePanels、共享client/contracts、rootmanifest/lock均不在拟议范围。

## 拟定窄界面与领取

拟生产文件为 `apps/web/src/workspace-feed/WorkspaceOverview.tsx`、新 `apps/web/src/workspace-feed/ActivityWindow.tsx`、`apps/web/src/workspace-feed/workspace-feed.css`。独立窗口模块负责可见行、变高测量、稳定entry/cursor锚点、焦点保留与范围语义；Overview只提供权威entries/status/callback和following状态。具体实现由owner选择，不为方案先新增状态库或依赖。

验证文件已冻结：`apps/web/test/workspace-window.test.ts`仅必要窗口公共算法行为；`apps/web/test/workspace-window.browser.ts`完整性/交互；正式转交现有 `apps/web/test/performance-probe.ts`复用同一测量引擎，不复制第二份。PERF01原owner需先停写probe并amend移出，其旧raw证据不得覆盖；PERF02结果写新evidence目录。`performance-fixture.ts`只读复用，不用test父目录通配授权。canonical计划和证据后续拟 `plans/wpf-perf02-activity-window/`、`docs/evidence/wpf-perf02/`。

实际03:30已按下列步骤完成：原owner确认停写；逐文件核全部现存文件，将M02 parent范围展开为保留的Attention.tsx、projection.ts、task-index.ts、TaskIndex.tsx；按currentversion amend移出三拟文件/新文件位置，另PERF01移出probe；新独立tree/branch初始化固定已审输入；committed take receipt后才写。未列明新文件不自动属于任何writer。PERF01正式review和主线明确允许均已满足；I01/App等范围未侵入。

## 可验证验收

- 窗口遍历核完整cursor/id与正文hash，历史全部可达；原HTTP前后游标、迟到提交、去重与projection数据不变。新probe不再要求10040条同时存在DOM，但不能仅用可见数量替代完整性。
- 变高正文/390px换行、加载较早、阅读中追加缓冲、reveal追尾、切换再返回保持明确entry与offset；浏览器自动锚定与手工补偿只能有一套可测策略。
- 键盘可进入并连续浏览历史，焦点所在行不得被窗口卸载到body；语义列表/范围提示与屏读限制如实记录，不只贴role=feed声称协议完整。
- 决策提示及时，详情仍未打开0/首次1/重复缓存，任务与引用不串；8chat观察预算/不暗cancel回归不退化。
- 相同固定fixture/机器/普通production方法比较前后DOM、真实输入/滚动、reveal及按phase长任务；保留一次/量化/未采样/未知限制。数据驻留仍线性时明确剩余，不声称整体内存解决。
- 双主题、390px、键盘、reduced-motion；局部模块+直接依赖，必要浏览器/生产测量，不机械重复全库。

## TODO

- [ ] **WPF-PERF02-01** 收PERF01正式review、固定输入和精确测试接口；完成M02停写、amend/take与canonical转交。
- [ ] **WPF-PERF02-02** 在独立scope实现有界Activity显示/锚点和必要焦点生命周期；保留全部数据。
- [ ] **WPF-PERF02-03** 完整性/交互/主题与同方法生产测量，记录实际发现、clean-code和未解决项。
- [ ] **WPF-PERF02-04** 固定target独立review、修复与Lead集成；未验证不完成。
