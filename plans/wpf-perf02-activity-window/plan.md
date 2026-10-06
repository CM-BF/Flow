# WPF-PERF02 Activity 有界显示窗口

创建/更新：2026-10-06 03:33 UTC；状态 in-progress。唯一 owner w01_owner，模型派发 gpt-6-astra / ultra；本运行系统身份 GPT-6，派发配置来自协调器。输入 `cc33403cd9b357fcd85484b7bc6952dc1220d689`（已审 PERF01，固定 M02 产品基线，非 I01/CHAT 最终产品）。

## 授权与目标

03:25 暂缓是历史。03:30 管理者明确恢复此八路径独立实施，真实对话由其他 owner 优先推进。D04 claim `d36cd583-7c96-44c3-b92c-1cd0f208cc4e` v1 active，03:31:55 live核验；[原回执](../../docs/evidence/wpf-perf02/take-receipt.json)。不复用旧 claim；M02 与 PERF01 已先 amend 移出本次路径。

PERF01 真实生产 fixture 每场 10040 条记录同时渲染约 7 万 DOM。仅改 Activity 的可见窗口、行高度/稳定 ID 锚点与键盘焦点生命周期，保留 projection 全量记录与 HTTP 语义；不删历史来改善数字。新模块 `ActivityWindow` 接收记录、摘要与窄回调，隐藏高度索引、窗口和滚动测量。Overview 提供权威状态与触发，不引状态库/新生产依赖。

采用基于实际测量行高的窗口和上下占位，二分查找可见区；缓冲若干行，焦点行独立保留。原生滚动/明确前后窗口导航均可访问全部已加载历史，之前尚未载入历史沿原公共按钮加载。浏览器自动锚定关闭，单一手工 ID+offset 策略恢复；主题/窄屏换行重新测量。任务/中心切换不扩本批范围。

## 独占范围

- apps/web/src/workspace-feed/WorkspaceOverview.tsx
- apps/web/src/workspace-feed/ActivityWindow.tsx
- apps/web/src/workspace-feed/workspace-feed.css
- apps/web/test/workspace-window.test.ts
- apps/web/test/workspace-window.browser.ts
- apps/web/test/performance-probe.ts
- plans/wpf-perf02-activity-window/
- docs/evidence/wpf-perf02/

不修改 projection、Attention、App、Thread、host、既有 workspace组件、contracts/client、manifest 或 root lock。安装仅既有依赖 `pnpm install --offline --no-lockfile --ignore-scripts`，先核 CLI 帮助确定不读写 lock；本树 workspace链接，不借其他树 client。计划总索引由 Lead 更新。

## 验收与证据方法

模块检查高度查找、前后插入锚点、边界和焦点独立保留；浏览器遍历整个窗口核 cursor/id/正文 hash，全部历史可达。验证变高/390px换行、读取时追加缓冲/明确追尾、index/chat返回、Tab连续访问、焦点行不落body、双主题/reduced motion。详情 0→1→cache、attention和8chat观察预算沿已审行为保留。

复用唯一 performance-probe.ts，输出仅新 evidence。普通 production 构建相同 fixture、1/16/128任务每场总10000新增，阶段100/1000/5000/10000；保留量化、样本不足、无GC、同机并行负载等限制。窗口遍历完整性单独阶段，不能把其开销伪作旧场景可比 timing。p95/React render count未知仍null，projection驻留仍线性单列。先行为证据，再判断 DOM/长任务变化，不承诺解决全部长任务。

## TODO

- [x] **WPF-PERF02-01** 固定已审输入、claim转交、独立worktree与本 canonical。
- [x] **WPF-PERF02-02** 实现有界 Activity、稳定锚点与焦点，保留全量数据。
- [x] **WPF-PERF02-03** 完整性/交互/主题及同方法生产测量，保存失败/clean-code/限制。
- [ ] **WPF-PERF02-04** 固定target独立review、修复、Lead交付；main集成另证。

架构影响：仅 Web 现有 Activity 渲染内部新增深模块；公共Interface/数据库/外部依赖不变。最终target交Lead判断架构图更新入口，不改未领架构文件。
