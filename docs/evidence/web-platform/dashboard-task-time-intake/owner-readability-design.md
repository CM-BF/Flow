# D01 时间易读后继：只读设计建议

结论：沿原时间展示追加有界呈现片。主读只回答“何时开工、完成了没有、已过多久、为何等待”，UTC、来源和诊断收进一个原生“时间依据”折叠区。保留现字体、浅深主题和层级，不加新字体、动画或时间状态源。本稿 NOT_TAKEN / NOT_IMPLEMENTED / NOT_RUN。

固定依据：主线52fe66693c370aec72dd8a36ed3fa00292e5127b；五相关文件逐字等于组合target080e1f0e45966016b24c6cd97b742e6e024977ed，其中四产品为原72a。已释放owner树实际4b78a1de…clean，只读。Lead79da82…等待合同、root研究与本地技能的完整hash在audit.json。

## 主读与渐进展开

卡片保留现有任务标题/摘要，只增加紧凑两至三行：

    开工 2026/10/06 18:00 GMT−07:00   尚未完成
    已历时 2小时（含等待，截至本次同步）
    等待：可用验证窗口（负责人声明）

时间区域明确“本地时间 America/Los_Angeles”；以上是设计示例而非新增观测。无等待记录显示“等待情况未记录”，不写“没有等待”。多条OPEN按源顺序汇总明确条数，卡片只露首条原因及“另N条，见详情”；不按顺序猜最后一条是当前阻塞，不复制human blocker为等待事实。

详情顶部复用同一派生呈现：开工、完成/尚未完成、含等待历时、等待原因。每个已知时间使用`time[datetime=规范UTC]`，保完整年份以免跨年含混。较简短历时可省零单位（2小时而非0天2小时0分0秒），不改变原秒级差值、取整或完成条件。NOT_COMPLETED只能写“尚未完成”，不能写“正在运行”。未知/陈旧需始终有可见提示，不能全藏进折叠区。

一个原生details/summary“时间依据”默认关闭，包含完整UTC、负责人来源、选定快照UTC、权威status路径、诊断和等待表原文。不要把path/SHA/毫秒原文挤入首屏，也不删它们。长reason/来源以textContent渲染；不把Markdown链接变成任意URL访问，不用innerHTML或通用Markdown包。

## 时间和等待语义

复用一个固定locale+resolved timezone的Intl.DateTimeFormat实例，卡片与详情共享；不在185张卡逐个构造，不新增时区偏好store。每个时间包含该instant的GMT offset，区域还命名IANA zone；不要只用PDT/PST缩写。Root已核ECMA402/2025的resolvedOptions/timeZone/shortOffset依据，但本后继未作浏览器兼容验证。无有效zone/formatter时显式退回UTC，不回退无zone的本地字符串。

DST验收固定2026-11-01T08:30:00Z与09:30:00Z：America/Los_Angeles均为01:30，但分别GMT−07与GMT−08；UTC依据保持两者可区分。跨年也显示完整年份。测试比较时间部分/offset/UTC identity，不把locale整段标点逐字固定。历时仍只用源UTC与同snapshot.generatedAt，绝不使用Date.now或定时累加。

等待表仅识别合同的六列`ID | 开始UTC | 结束UTC | 类别 | 原因与解除条件 | 来源`，复用status.cells与严格UTC内核；保现`timing.waiting`原字符串，新增派生`timing.waitingTable={rows,issues}`。合法行按源顺序保留，ID/类别/原因/来源均为文字。坏header、缺列/多列、重复ID、无效UTC与历史非规范注解留原文并隔离报告，不能选择最后值或猜语义。

| 结束字段 | 可表达的事实 |
| --- | --- |
| 精确OPEN | 负责人声明未结束；仅当前可信快照可称“仍在等待（截至本次同步）” |
| 精确UNKNOWN/空 | 结束时间或结束情况未知；不是OPEN |
| UNKNOWN（已结束）等历史注解 | 非规范结束声明，显示“结束声明待核对”；原文可见，绝不当OPEN |
| 合法UTC | 可展示结束时间；未来/逆序区间提示待核对，不推当前已结束 |

start未知但end已知仍可分别展示，两者不足时不算区间。原等待来源缺失/不可信可保原因但标“来源待核对”，不生成已核当前等待结论。OPEN遇frozen/stale/刷新失败或旧详情快照，写“当时记录未结束；当前未知”。不合计重叠等待，不扣净工时，不让坏等待记录改变全任务完成状态。

**必须隔离：**现app.js:39–40只要`timing.issues.length`就令任务历时未知。新增等待解析issues必须放`waitingTable.issues`，不能混入原timing.issues或status.errors，否则一行坏等待会抹掉有效开工/完成历时；这也是必要定向回归。

## 最小实现接缝和窄屏

status.mjs:41–63/74–107承担唯一源解析；只扩派生等待字段，旧timing.waiting和原时间约束不变。app.js:32–81共用一个私有派生呈现seam（task、观察snapshot、fresh、固定formatter），用于summaryTiming/timingDetails；不另建公开状态Module或修改aggregate/server。

等待主读用真实两列table：`原因/类别`与`开始、结束及其状态`；ID/来源在可展开依据，原六列原文完整保留。caption声明“负责人等待记录，不合计时长”，th scope明确。宽屏可读，390px table-layout:fixed/min-width:0/单元overflow-wrap:anywhere；两列不强制日期同一行，不把原六宽列带进窄屏。若单条文字极长允许正常纵向增长，原文pre-wrap，避免整页横滚。沿现styles.css:410–425/569–579的minmax(0,1fr)、换行与窄屏规则，只加timing局部样式。

沿app.js:73–80、177–188、209–218，已打开详情继续持有selectedTask/selectedSnapshot。自动刷新只修改确定的freshness/elapsed/等待状态提示节点，不能重建details/table、强关弹窗、重置展开/scroll/文字选区或抢焦点。新快照到来旧详情仍标旧，不把新的等待原因偷偷覆盖进去；显式关闭重开才读取新snapshot。原card刷新重绘行为不扩成全dashboard稳定DOM重构。

## 候选精确scope与所有权

最窄建议**七literal，全部NOT_TAKEN**：
1. apps/execution-dashboard/src/status.mjs
2. apps/execution-dashboard/public/app.js
3. apps/execution-dashboard/public/styles.css
4. apps/execution-dashboard/test/status-timestamps.test.mjs
5. apps/execution-dashboard/test/task-timing.browser.mjs
6. plans/wpf-dashboard-task-timing
7. docs/evidence/wpf-dashboard-task-timing

不新增helper路径、runner、store、server、registry、indexHTML、锁文件或依赖。CSS是新增必要scope，旧六范围不能继承。默认同feature计划追加稳定TIMING01-06（可读呈现/等待派生）、07（直接回归/窄屏证据）、08（独审/后继接收）；原01–05和03:56:00.608Z已完成事实保持历史，不在本设计修改或重置。manager决定同feature后继工作树与实际新claim及源阶段表达；旧9a677 v2已released，不复活旧写权。先fresh确认app/status/CSS/测试无并发owner，尤其DPERF虽曾交回app也不能据旧回执推断当前可写。只从届时固定已审main开始；不携DPERF未完整验收app/server。主线写权仍Lead。

## 必要验证（均未执行）

复用原两个实际入口，不另造runner。Node原status-timestamps单文件81基线在parser改动后重跑一次，增加表头/转义pipe/OPEN/UNKNOWN/历史注解/坏行/重复ID/源缺失/有效任务历时不受坏wait影响；原81是基线，不给新target背书。保普通更新时间/progress/checks/review/main隔离断言。

现runTaskTimingChecks五组保留原含等待elapsed/分支完成不结束/未知陈旧/失败与新snapshot不抢焦点/双主题390的语义，必要文本定位同步到新主读及展开后的依据，不能删原UTC/来源/WAIT01/不求和断言。加直接受影响子用例：details Enter/Space开合、展开与滚动/选区在实际auto callback刷新后保留；两列等待表长ASCII/中文/emoji/HTML样文本无横溢出、未执行HTML；OPEN与UNKNOWN含历史已结束注解不串；固定timezone下DST同墙钟异offset和跨年；不可用formatter显式UTC回退。两张新390PNG应含实际等待主读和可达依据，原5组旧截图不替代新结果。预算由manager后续工作段/真实heavy窗口确定，本研究无预约或运行许可。

技能应用：本地find-skills优先发现已安装版本；frontend-design只改善信息顺序/文案与留白，保已有视觉系统；codebase-design把单status解析和共享派生呈现作为小Interface，避免双份真相；clean-code复用严格日期内核、独立错误域与DOM文字输出；brainstorming按已授权有界设计研究收敛一个方案，不触发额外询问/原型/项目写。精确skill内容hash在audit。未导入产品、未跑Node/浏览器/服务/检查、未采space或进程、未新增claim。
