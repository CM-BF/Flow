# WPF-DASHBOARD-TIMING01 任务时间展示

状态：in-progress。创建 2026-10-07。直接父 [D01](../d01-execution-dashboard/plan.md)，co-lead Web /root，唯一 owner w01_owner / Astra Ultra。

在现有任务摘要与详情展示唯一 owner 声明的开工、完成、时间来源，以及包含等待的壁钟历时。沿 [固定时间合同](../AGENTS.md#task-timing)，不根据提交、mtime、领取或分支交付猜全任务完成。缺失/非法时间只影响该项；旧进度与 proof 判定保持。仅同一可信快照的 generatedAt 可用于未完成历时，不增加计时器。

## Interface 与范围

status Module 解析顶层三字段，返回 timing（声明、规范 UTC、独立 issues）；app Module 在共享摘要与详情消费 timing 和现 snapshot/source。现 aggregate 原样传递 status，不加第二状态源。等待只保显式区间/来源，不求净工作时长。历史 review/main/部署维持原目标证据。

精确六范围见 [source intake](../../docs/evidence/wpf-dashboard-task-timing/source-intake.json)。两个产品文件 status.mjs/app.js；parser 专测与新 fixture-only browser；自身 plan/evidence。server/aggregate/CSS/registry 和 DPERF 未验版本不改。

## TODO

- [x] TIMING01-01：严格三字段解析、异常隔离与旧记录兼容。
- [ ] TIMING01-02：摘要/详情显示时间与同快照历时、失败旧快照降为历史。
- [x] TIMING01-03：有界 parser 行为检查，原始失败保留；browser 源码准备。
- [ ] TIMING01-04：隔离 browser 验收（另实际窗口），固定独审。
- [ ] TIMING01-05：Lead 主线接收，本片交付；部署单独记录。

## 验证与边界

普通 parser 工作段总≤5min、每命令≤30s、必要修复复测最多3次；TMP≤8MiB/raw≤1MiB，仅 Node 内置，无 PG/Chrome/安装/私人服务。真实 browser 尚未授权，不运行旧 task-links.browser 或真实 registry。旧 DPERF05 测试通过不继承新实现；浏览器未验不得冒整体通过。

实际状态与证据以 [status](status.md) 为唯一来源；独审入口 [review](review.md)。复用本地 find-skills/codebase-design/clean-code，方法及发现记录在 own evidence。
