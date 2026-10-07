# Dashboard 任务时间：固定源码供给请求（只读）

状态 SOURCE_ONLY_PROPOSAL / NOT_PROVISIONED / NOT_TAKEN。唯一固定 base `18144593a0f210e8d5b9b2c08f4ff62259c07cf5`；不追 moving main。建议新树 `/Users/citrine/Projects/AgentHarness/Flow-worktrees/dashboard-task-timing`、分支 `codex/dashboard-task-timing`。task ID 由管理唯一登记，直接父 D01。此报告不取得写权或运行窗口。

## 原 operator 可直接使用的供给清单

`source-input-manifest.json` 为 37 个精确 Git blob / SHA256 / bytes，合计 **572,960 逻辑字节**，低于 5 MiB。`paths.txt` 为同序 literal 清单。包含根/计划规则、原 D01 三件套、局部验证规则、dashboard 的 src/public/package/README 有限模块闭包，以及 fixture/status-timestamps/task-links.browser 三个现有测试入口或参考。保留有限模块整体以避免 server 的显式静态资源和 parser→proof→Git 间接读取漏件；这不是全仓 checkout。

只由原唯一 Git operator 按本固定 base 供给。此刻未检查或创建目标路径/branch、未修改 sparse/index/config。没有 node_modules、安装/复制依赖、私人 registry/config、历史 raw、build 输出。逻辑字节不是物理峰值/回收量/运行资源准入证明。新 test 与自身 plan/evidence 尚不存在，应由实际领取后的 owner 创建。

## 候选精确六范围（尚未领取）

1. `apps/execution-dashboard/src/status.mjs`
2. `apps/execution-dashboard/public/app.js`
3. `apps/execution-dashboard/test/status-timestamps.test.mjs`
4. `apps/execution-dashboard/test/task-timing.browser.mjs`
5. `plans/wpf-dashboard-task-timing`
6. `docs/evidence/wpf-dashboard-task-timing`

server/aggregate/human/registry/CSS、规则/template 和 parent 只读；预计不需更改。若真实接缝超出以上范围，先明确具体 path 再协调，不挟带 DPERF04 未验源码。

## 已固定 Interface，实施不重做设计

按本 base `plans/AGENTS.md#task-timing` 与 `plans/templates/status.md`：顶层唯一 owner status 三字段为任务开工时间、任务完成时间、任务时间来源。完整 UTC、明确 NOT_COMPLETED、UNKNOWN 不当正在做；源原文保留。只从同一可信 snapshot.generatedAt 算含等待壁钟，完成=end-start，明确未完=snapshot-start。无来源/非法日历/未来/逆序/缺失/陈旧或失败后的旧快照不展示仍在推进。不得使用浏览器 now、mtime、claim touch 或 status.updatedAt 猜开始。分支交付/独审/main/部署仍保持原 target 与 proof 语义。

parser 的新 timing/issue 结果经现 aggregate 原样传出；新可选字段缺失、重复冲突或单项非法不得混入会使 current/TODO 失效的原 status.errors。UI 只加紧凑摘要/既有详情中的 UTC、来源和截至时点，不新增每卡计时器/第二账本。等待表沿合同显式区间展示或保原文可达，不从状态字词推时长、不简单相加、不宣称净工作耗时。

## DPERF 部分交权已完成

原树 dashboard-summary-detail/codex 同名固定 `929b706a3bffcc94e31aba32467f88038bd6ea18`，此前本人核 clean，并明确 app.js/server.mjs 停写。管理确认原 claim `b554ddb6-094e-46db-90f3-b9e5deb78edb` 已在 2026-10-07 02:54:43.654Z amend 为 **v3 / 原余七范围**，仅此轮移出 app.js（server 已在 v2 移出）。原件 `/private/tmp/d01-dperf-app-handoff/receipt.json`。DPERF 任务不 release，旧源码/候选不改；将来 app/server 再写须重新协调。时间片从本 main source 开始。

## 验证与依赖边界

所有新功能与验收 **NOT_RUN**。领取后的普通局部实现/失败修复/必要 Node 复验沿一个有界工作段，不再逐命令申报；实际预算由派工确认。parser 专测为 Node 内置入口，保原日期兼容断言并添加三字段、隔离异常、明确结束状态。新 UI 专测仅自有少量 fixture，覆盖同快照历时、未完成与已分支交付的区别、旧快照/读取失败、UTC 来源、390 与键盘。

现 fixture 导入 server→aggregate→ledger，ledger 静态 `import pg from 'pg'`，包固定 `pg:8.23.1`；不能把该浏览器闭包说成无依赖。未来 browser 还需固定 Playwright/Chrome 与实际 readonly resolver/资源窗口；本次没有供给或解析任何依赖，不使用个人配置/真实登记/4320。现 task-links.browser 的旧输出目录、旧 90s 预算和旧 PASS 只作源码参考，不继承运行事实，也不能直接照跑。新 browser 当前未生成且未获运行许可。

## 方法与本段检查

复用并读取本地 find-skills、codebase-design、clean-code（实际 SKILL.md 路径/hash 在 manifest）：发现已安装适配技能不联网安装；收敛一个 status authority 和两个产品消费者；检查字段责任、错误隔离、旧事实兼容和有限供给闭包。clean-code 本段没有项目实现可改，未发现需要新增 store/框架/公共 source 的理由。仅固定 Git 对象读取、SHA/字节清点、private/tmp 报告；0 Node/import/test/HTTP/PG/Chrome/build/install/free/proc，0 项目写。当前没有本人实际重窗口进程或资源预约。
